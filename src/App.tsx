/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar, AdminTab, StudentTab } from './components/layout/Sidebar';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { ExamTakingView } from './components/student/ExamTakingView';
import { ExamResultView } from './components/student/ExamResultView';
import { Exam, Question, ExamSession } from './types';
import { GlobalLoaderBar } from './components/ui/Loader';

function MainLayout() {
  const { currentUser, role, isAuthenticated } = useAuth();

  // Sidebar navigation state
  const [adminTab, setAdminTab] = useState<AdminTab>('live');
  const [studentTab, setStudentTab] = useState<StudentTab>('active_exams');

  // Active exam session state
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [resultSession, setResultSession] = useState<ExamSession | null>(null);

  // If not logged in, show Login Screen (with Role switcher, Admin email/pass, Student group/name/pass selection)
  if (!isAuthenticated || !currentUser) {
    return <LoginScreen />;
  }

  const handleStartExam = (exam: Exam, questions: Question[]) => {
    setResultSession(null);
    setActiveExam(exam);
    setActiveQuestions(questions);
  };

  const handleFinishExam = (session: ExamSession) => {
    setActiveExam(null);
    setActiveQuestions([]);
    setResultSession(session);
  };

  const handleBackToDashboard = () => {
    setResultSession(null);
    setActiveExam(null);
    setActiveQuestions([]);
  };

  // Full-screen distraction-free mode during active exam
  if (activeExam) {
    return (
      <ExamTakingView
        exam={activeExam}
        questions={activeQuestions}
        onFinish={handleFinishExam}
      />
    );
  }

  // Result view with confetti and score breakdown
  if (resultSession) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 transition-colors">
        <ExamResultView
          session={resultSession}
          onBackToDashboard={handleBackToDashboard}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors">
      {/* Left Sidebar */}
      <Sidebar
        adminTab={adminTab}
        onAdminTabChange={setAdminTab}
        studentTab={studentTab}
        onStudentTabChange={setStudentTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
        {role === 'ADMIN' ? (
          <AdminDashboard activeTab={adminTab} />
        ) : (
          <StudentDashboard
            activeTab={studentTab}
            onStartExam={handleStartExam}
            onViewResult={(sess) => setResultSession(sess)}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GlobalLoaderBar />
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
