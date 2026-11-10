/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LiveMonitor } from './LiveMonitor';
import { GroupManager } from './GroupManager';
import { ExamManager } from './ExamManager';
import { QuestionManager } from './QuestionManager';
import { ArchitectureViewer } from './ArchitectureViewer';
import { AdminTab } from '../layout/Sidebar';

interface AdminDashboardProps {
  activeTab: AdminTab;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab }) => {
  return (
    <div className="space-y-6">
      {activeTab === 'live' && <LiveMonitor />}
      {activeTab === 'groups' && <GroupManager />}
      {activeTab === 'exams' && <ExamManager />}
      {activeTab === 'questions' && <QuestionManager />}
      {activeTab === 'architecture' && <ArchitectureViewer />}
    </div>
  );
};
