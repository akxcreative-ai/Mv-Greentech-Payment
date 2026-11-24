import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-navy-50 dark:bg-navy-950/60 text-navy-800 dark:text-cyan-400 flex items-center justify-center mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
        404 - Page Not Found
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
        The requested payment portal resource or route does not exist.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center px-4 py-2 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold rounded-lg shadow-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
