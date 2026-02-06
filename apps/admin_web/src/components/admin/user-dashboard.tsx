'use client';

import { useEffect, useState } from 'react';

import {
  ApiError,
  getUserAccessStatus,
  getUserSuggestions,
  type AccessRequest,
  type ManagerStatusResponse,
} from '../../lib/api-client';
import type { OrganizationSuggestion } from '../../types/admin';
import { useAuth } from '../auth-provider';
import { AppShell } from '../app-shell';
import { StatusBanner } from '../status-banner';
import { AccessRequestForm } from './access-request-form';
import { PendingRequestNotice } from './pending-request-notice';
import { SuggestionForm } from './suggestion-form';
import { PendingSuggestionNotice } from './pending-suggestion-notice';

const sectionLabels = [
  { key: 'become-manager', label: 'Become a Manager' },
  { key: 'suggest-place', label: 'Suggest a Place' },
];

/**
 * Dashboard for regular logged-in users who are not yet managers or admins.
 * Allows them to:
 * - Submit a request to become a manager of an organization
 * - Suggest new places/organizations for the platform
 */
export function UserDashboard() {
  const { user, logout, error: authError } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('suggest-place');

  // Access request state
  const [pendingRequest, setPendingRequest] = useState<AccessRequest | null>(null);

  // Suggestion state
  const [pendingSuggestion, setPendingSuggestion] =
    useState<OrganizationSuggestion | null>(null);

  const loadUserStatus = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Load both access request status and suggestions in parallel
      const [accessStatus, suggestionsStatus] = await Promise.all([
        getUserAccessStatus(),
        getUserSuggestions(),
      ]);

      // Check for pending access request
      if (accessStatus.has_pending_request && accessStatus.pending_request) {
        setPendingRequest(accessStatus.pending_request);
      }

      // Check for pending suggestion
      if (suggestionsStatus.has_pending_suggestion) {
        const pending = suggestionsStatus.suggestions.find(
          (s) => s.status === 'pending'
        );
        if (pending) {
          setPendingSuggestion(pending);
        }
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Failed to load your account status.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserStatus();
  }, []);

  const handleRequestSubmitted = (request: AccessRequest) => {
    setPendingRequest(request);
  };

  const handleSuggestionSubmitted = (suggestion: OrganizationSuggestion) => {
    setPendingSuggestion(suggestion);
  };

  // Loading state
  if (isLoading) {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Loading'>
          Loading your account information...
        </StatusBanner>
      </main>
    );
  }

  // Render the active section content
  const renderContent = () => {
    if (activeSection === 'become-manager') {
      if (pendingRequest) {
        return <PendingRequestNotice request={pendingRequest} />;
      }
      return <AccessRequestForm onRequestSubmitted={handleRequestSubmitted} />;
    }

    // suggest-place section
    if (pendingSuggestion) {
      return <PendingSuggestionNotice suggestion={pendingSuggestion} />;
    }
    return <SuggestionForm onSuggestionSubmitted={handleSuggestionSubmitted} />;
  };

  return (
    <AppShell
      sections={sectionLabels}
      activeKey={activeSection}
      onSelect={setActiveSection}
      onLogout={logout}
      userEmail={user?.email}
      lastAuthTime={user?.lastAuthTime}
    >
      {authError && (
        <StatusBanner variant='error' title='Session'>
          {authError}
        </StatusBanner>
      )}
      {error && (
        <StatusBanner variant='error' title='Error'>
          {error}
        </StatusBanner>
      )}
      {renderContent()}
    </AppShell>
  );
}
