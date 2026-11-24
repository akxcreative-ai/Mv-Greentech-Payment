"""
Asynchronous Email Notification Service.

Utilizes aiosmtplib to dispatch transactional and notification emails.
Provides automated templates and handlers for payment approval workflows:
- Approval notifications for designated approvers
- Rejection notifications with feedback
- Clarification requests between approvers and requesters
"""

from email.message import EmailMessage
import logging
from typing import Any, Dict, List, Optional, Union

try:
    import aiosmtplib
    from aiosmtplib.errors import SMTPException
except ImportError:
    aiosmtplib = None
    SMTPException = Exception

try:
    from jinja2 import Template
except ImportError:
    # Graceful fallback template engine if jinja2 is not yet installed
    class Template:  # type: ignore
        def __init__(self, template_str: str):
            self.template_str = template_str

        def render(self, **kwargs: Any) -> str:
            rendered = self.template_str
            for key, val in kwargs.items():
                rendered = rendered.replace(f"{{{{ {key} }}}}", str(val))
                rendered = rendered.replace(f"{{{{{key}}}}}", str(val))
            return rendered

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ==============================================================================
# HTML EMAIL TEMPLATES
# ==============================================================================

BASE_EMAIL_LAYOUT = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ subject }}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #f3f4f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background-color: #1e3a8a;
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 28px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .badge-pending { background-color: #fef3c7; color: #92400e; }
    .badge-rejected { background-color: #fee2e2; color: #991b1b; }
    .badge-clarify { background-color: #e0e7ff; color: #3730a3; }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .details-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .details-table td.label {
      width: 35%;
      color: #6b7280;
      font-weight: 600;
    }
    .details-table td.value {
      color: #111827;
      font-weight: 500;
    }
    .message-box {
      background-color: #f9fafb;
      border-left: 4px solid #3b82f6;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 0 6px 6px 0;
      font-size: 14px;
      color: #374151;
    }
    .button-container {
      text-align: center;
      margin: 32px 0 16px;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{ app_name }}</h1>
    </div>
    <div class="content">
      {{ content }}
    </div>
    <div class="footer">
      <p>This is an automated notification from {{ app_name }}. Please do not reply directly to this email.</p>
      <p>&copy; MV Payment Approval System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
"""

APPROVAL_BODY_TEMPLATE = """
<span class="badge badge-pending">Approval Required</span>
<h2 style="margin-top: 0; color: #111827;">Action Required: Payment Request Pending</h2>
<p>Hello <strong>{{ approver_name }}</strong>,</p>
<p>A new payment request has been submitted and is currently awaiting your review and approval.</p>

<table class="details-table">
  <tr>
    <td class="label">Request Number:</td>
    <td class="value"><strong>#{{ request_number }}</strong></td>
  </tr>
  <tr>
    <td class="label">Requester:</td>
    <td class="value">{{ requester_name }}</td>
  </tr>
  <tr>
    <td class="label">Vendor / Payee:</td>
    <td class="value">{{ vendor_name }}</td>
  </tr>
  <tr>
    <td class="label">Total Amount:</td>
    <td class="value"><strong style="color: #059669; font-size: 16px;">{{ currency }} {{ amount }}</strong></td>
  </tr>
  <tr>
    <td class="label">Category:</td>
    <td class="value">{{ category }}</td>
  </tr>
  <tr>
    <td class="label">Description:</td>
    <td class="value">{{ description }}</td>
  </tr>
</table>

<div class="button-container">
  <a href="{{ action_url }}" class="btn">Review & Take Action</a>
</div>
"""

REJECTION_BODY_TEMPLATE = """
<span class="badge badge-rejected">Request Rejected</span>
<h2 style="margin-top: 0; color: #991b1b;">Payment Request Rejected</h2>
<p>Hello <strong>{{ requester_name }}</strong>,</p>
<p>Your payment request <strong>#{{ request_number }}</strong> has been reviewed and rejected.</p>

<table class="details-table">
  <tr>
    <td class="label">Request Number:</td>
    <td class="value"><strong>#{{ request_number }}</strong></td>
  </tr>
  <tr>
    <td class="label">Vendor / Payee:</td>
    <td class="value">{{ vendor_name }}</td>
  </tr>
  <tr>
    <td class="label">Total Amount:</td>
    <td class="value">{{ currency }} {{ amount }}</td>
  </tr>
</table>

<div class="message-box" style="border-left-color: #ef4444; background-color: #fef2f2;">
  <strong>Reason for Rejection:</strong>
  <p style="margin: 8px 0 0 0; color: #7f1d1d;">{{ reason }}</p>
</div>

<div class="button-container">
  <a href="{{ action_url }}" class="btn" style="background-color: #4b5563;">View Request Details</a>
</div>
"""

CLARIFICATION_BODY_TEMPLATE = """
<span class="badge badge-clarify">Clarification Requested</span>
<h2 style="margin-top: 0; color: #1e3a8a;">Clarification Needed on Payment Request</h2>
<p>Hello <strong>{{ recipient_name }}</strong>,</p>
<p>An approver has requested further information or clarification regarding payment request <strong>#{{ request_number }}</strong>.</p>

<table class="details-table">
  <tr>
    <td class="label">Request Number:</td>
    <td class="value"><strong>#{{ request_number }}</strong></td>
  </tr>
  <tr>
    <td class="label">Vendor / Payee:</td>
    <td class="value">{{ vendor_name }}</td>
  </tr>
  <tr>
    <td class="label">Total Amount:</td>
    <td class="value">{{ currency }} {{ amount }}</td>
  </tr>
</table>

<div class="message-box" style="border-left-color: #6366f1;">
  <strong>Message / Inquiry:</strong>
  <p style="margin: 8px 0 0 0;">{{ message }}</p>
</div>

<div class="button-container">
  <a href="{{ action_url }}" class="btn">Respond to Clarification</a>
</div>
"""


def _get_field(obj: Any, key: str, default: Any = "") -> Any:
    """Helper to safely retrieve attributes or dictionary keys."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


async def send_email(
    to: Union[str, List[str]],
    subject: str,
    body: str,
    html: Optional[str] = None,
) -> bool:
    """
    Sends an asynchronous email message via SMTP using aiosmtplib.

    Args:
        to: Single email address or list of recipient email addresses.
        subject: Email subject line.
        body: Plain-text fallback email body.
        html: Optional HTML version of the email.

    Returns:
        True if the email was dispatched successfully, False otherwise.
    """
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [r.strip() for r in recipients if r and r.strip()]

    if not recipients:
        logger.warning("Email dispatch skipped: No valid recipients provided.")
        return False

    # Check if SMTP configuration is present
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(
            "SMTP is not configured (SMTP_HOST/SMTP_USER empty). Simulating dispatch: "
            "To: %s | Subject: %s",
            recipients,
            subject,
        )
        return True

    # Construct EmailMessage
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)

    if html:
        message.add_alternative(html, subtype="html")

    if aiosmtplib is None:
        logger.warning("aiosmtplib is not installed; email could not be sent to %s.", recipients)
        return False

    try:
        # Determine TLS settings based on standard ports
        use_tls = settings.SMTP_PORT == 465
        start_tls = settings.SMTP_PORT == 587

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER if settings.SMTP_USER else None,
            password=settings.SMTP_PASSWORD if settings.SMTP_PASSWORD else None,
            use_tls=use_tls,
            start_tls=start_tls,
            timeout=15,
        )
        logger.info("Email successfully sent to: %s | Subject: '%s'", recipients, subject)
        return True

    except SMTPException as exc:
        logger.error("SMTP error sending email to %s: %s", recipients, exc, exc_info=True)
        return False
    except Exception as exc:
        logger.error("Unexpected error sending email to %s: %s", recipients, exc, exc_info=True)
        return False


async def send_approval_notification(
    request: Union[Dict[str, Any], Any],
    approver: Union[Dict[str, Any], Any],
) -> bool:
    """
    Sends an approval notification to a designated approver.

    Args:
        request: Payment request dictionary or ORM model.
        approver: Approver user dictionary or ORM model.

    Returns:
        True on successful dispatch, False otherwise.
    """
    approver_email = _get_field(approver, "email")
    if not approver_email:
        logger.warning("Cannot send approval notification: approver email missing.")
        return False

    approver_name = _get_field(approver, "full_name") or _get_field(approver, "name") or "Approver"
    requester_name = _get_field(request, "requester_name") or "Team Member"
    request_number = _get_field(request, "request_number") or _get_field(request, "id", "NEW")
    amount = _get_field(request, "amount", "0.00")
    currency = _get_field(request, "currency", "USD")
    vendor_name = _get_field(request, "vendor_name") or _get_field(request, "vendor", "N/A")
    category = _get_field(request, "category", "General Expense")
    description = _get_field(request, "description", "Payment request submitted for approval.")
    request_id = _get_field(request, "id", "")

    action_url = f"{settings.APP_URL.rstrip('/')}/approvals/{request_id}"
    subject = f"[{settings.APP_NAME}] Action Required: Approval for Payment Request #{request_number}"

    # Render HTML content
    body_html = Template(APPROVAL_BODY_TEMPLATE).render(
        approver_name=approver_name,
        requester_name=requester_name,
        request_number=request_number,
        amount=f"{float(amount):,.2f}" if isinstance(amount, (int, float, str)) and str(amount).replace('.', '', 1).isdigit() else str(amount),
        currency=currency,
        vendor_name=vendor_name,
        category=category,
        description=description,
        action_url=action_url,
    )
    full_html = Template(BASE_EMAIL_LAYOUT).render(
        app_name=settings.APP_NAME,
        subject=subject,
        content=body_html,
    )

    plain_body = (
        f"Payment Request #{request_number} requires your approval.\n\n"
        f"Requester: {requester_name}\n"
        f"Vendor: {vendor_name}\n"
        f"Amount: {currency} {amount}\n"
        f"Category: {category}\n"
        f"Description: {description}\n\n"
        f"Review and take action at: {action_url}\n"
    )

    return await send_email(to=approver_email, subject=subject, body=plain_body, html=full_html)


async def send_rejection_notification(
    request: Union[Dict[str, Any], Any],
    reason: str,
    recipient_email: Optional[str] = None,
) -> bool:
    """
    Sends a rejection notice to the request submitter detailing the reason.

    Args:
        request: Payment request dictionary or ORM model.
        reason: Justification provided for rejecting the request.
        recipient_email: Optional override for the recipient email.

    Returns:
        True on successful dispatch, False otherwise.
    """
    to_email = recipient_email or _get_field(request, "requester_email")
    if not to_email:
        logger.warning("Cannot send rejection notification: recipient email missing.")
        return False

    requester_name = _get_field(request, "requester_name") or "Requester"
    request_number = _get_field(request, "request_number") or _get_field(request, "id", "N/A")
    amount = _get_field(request, "amount", "0.00")
    currency = _get_field(request, "currency", "USD")
    vendor_name = _get_field(request, "vendor_name") or _get_field(request, "vendor", "N/A")
    request_id = _get_field(request, "id", "")

    action_url = f"{settings.APP_URL.rstrip('/')}/requests/{request_id}"
    subject = f"[{settings.APP_NAME}] Update: Payment Request #{request_number} Rejected"

    body_html = Template(REJECTION_BODY_TEMPLATE).render(
        requester_name=requester_name,
        request_number=request_number,
        amount=f"{float(amount):,.2f}" if isinstance(amount, (int, float, str)) and str(amount).replace('.', '', 1).isdigit() else str(amount),
        currency=currency,
        vendor_name=vendor_name,
        reason=reason,
        action_url=action_url,
    )
    full_html = Template(BASE_EMAIL_LAYOUT).render(
        app_name=settings.APP_NAME,
        subject=subject,
        content=body_html,
    )

    plain_body = (
        f"Your Payment Request #{request_number} has been rejected.\n\n"
        f"Vendor: {vendor_name}\n"
        f"Amount: {currency} {amount}\n"
        f"Reason: {reason}\n\n"
        f"View details at: {action_url}\n"
    )

    return await send_email(to=to_email, subject=subject, body=plain_body, html=full_html)


async def send_clarification_notification(
    request: Union[Dict[str, Any], Any],
    message: str,
    recipient_email: Optional[str] = None,
) -> bool:
    """
    Sends an inquiry/clarification request notification.

    Args:
        request: Payment request dictionary or ORM model.
        message: The message or question requiring clarification.
        recipient_email: Optional recipient email address.

    Returns:
        True on successful dispatch, False otherwise.
    """
    to_email = recipient_email or _get_field(request, "requester_email")
    if not to_email:
        logger.warning("Cannot send clarification notification: recipient email missing.")
        return False

    recipient_name = _get_field(request, "requester_name") or "Colleague"
    request_number = _get_field(request, "request_number") or _get_field(request, "id", "N/A")
    amount = _get_field(request, "amount", "0.00")
    currency = _get_field(request, "currency", "USD")
    vendor_name = _get_field(request, "vendor_name") or _get_field(request, "vendor", "N/A")
    request_id = _get_field(request, "id", "")

    action_url = f"{settings.APP_URL.rstrip('/')}/requests/{request_id}"
    subject = f"[{settings.APP_NAME}] Clarification Needed: Payment Request #{request_number}"

    body_html = Template(CLARIFICATION_BODY_TEMPLATE).render(
        recipient_name=recipient_name,
        request_number=request_number,
        amount=f"{float(amount):,.2f}" if isinstance(amount, (int, float, str)) and str(amount).replace('.', '', 1).isdigit() else str(amount),
        currency=currency,
        vendor_name=vendor_name,
        message=message,
        action_url=action_url,
    )
    full_html = Template(BASE_EMAIL_LAYOUT).render(
        app_name=settings.APP_NAME,
        subject=subject,
        content=body_html,
    )

    plain_body = (
        f"Clarification is requested for Payment Request #{request_number}.\n\n"
        f"Vendor: {vendor_name}\n"
        f"Amount: {currency} {amount}\n"
        f"Inquiry: {message}\n\n"
        f"Please reply or provide clarification at: {action_url}\n"
    )

    return await send_email(to=to_email, subject=subject, body=plain_body, html=full_html)
