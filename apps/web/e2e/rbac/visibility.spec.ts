/**
 * E2E Test: Content Visibility Boundaries
 *
 * T137 Add E2E test for content visibility boundaries
 *
 * Tests:
 * - Users see only their own conversations
 * - Managers see conversations of group members
 * - Tenant admins see all tenant conversations
 * - Audit logging for cross-boundary access
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Data
// =============================================================================

const TEST_DATA = {
  regularUser: {
    email: 'user-visibility@example.com',
    password: 'TestPassword123!',
    name: 'Regular User',
  },
  managerUser: {
    email: 'manager-visibility@example.com',
    password: 'TestPassword123!',
    name: 'Manager User',
  },
  adminUser: {
    email: 'admin-visibility@example.com',
    password: 'TestPassword123!',
    name: 'Admin User',
  },
  conversations: {
    own: 'My Own Conversation',
    groupMember: 'Group Member Conversation',
    otherGroup: 'Other Group Conversation',
    anyTenant: 'Any Tenant Conversation',
  },
};

// =============================================================================
// Page Objects
// =============================================================================

class ConversationListPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/conversations');
  }

  async getVisibleConversations() {
    const conversationElements = await this.page.$$(
      '[data-testid^="conversation-card-"]'
    );
    const conversations = [];
    for (const element of conversationElements) {
      const id = await element.getAttribute('data-testid');
      const title = await element.$eval(
        '[data-testid="conversation-title"]',
        (el) => el.textContent || ''
      );
      const ownerId = await element.getAttribute('data-owner-id');
      conversations.push({ id, title, ownerId });
    }
    return conversations;
  }

  async openConversation(conversationId: string) {
    await this.page.click(`[data-testid="conversation-card-${conversationId}"]`);
  }

  async searchConversations(query: string) {
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.click('[data-testid="search-button"]');
  }

  async getAccessDeniedMessage() {
    const isVisible = await this.page.isVisible(
      '[data-testid="access-denied-message"]'
    );
    if (isVisible) {
      return await this.page.textContent(
        '[data-testid="access-denied-message"]'
      );
    }
    return null;
  }
}

class AuditLogPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings/audit');
  }

  async getAuditEvents() {
    const eventElements = await this.page.$$(
      '[data-testid^="audit-event-"]'
    );
    const events = [];
    for (const element of eventElements) {
      const action = await element.getAttribute('data-action');
      const userId = await element.getAttribute('data-user-id');
      const timestamp = await element.$eval(
        '[data-testid="event-timestamp"]',
        (el) => el.textContent || ''
      );
      events.push({ action, userId, timestamp });
    }
    return events;
  }

  async filterByAction(action: string) {
    await this.page.selectOption('[data-testid="filter-action"]', action);
    await this.page.click('[data-testid="apply-filter"]');
  }
}

// =============================================================================
// E2E Tests
// =============================================================================

test.describe('T137 E2E: Content Visibility Boundaries', () => {
  let page: Page;
  let conversationPage: ConversationListPage;
  let auditPage: AuditLogPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    conversationPage = new ConversationListPage(page);
    auditPage = new AuditLogPage(page);
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  /**
   * Test 1: Regular user sees only own conversations
   */
  test('should show only own conversations to regular user', async () => {
    // Login as regular user
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.regularUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.regularUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to conversations
    await conversationPage.goto();

    // Get visible conversations
    const conversations = await conversationPage.getVisibleConversations();

    // Should only see own conversation
    expect(conversations.length).toBeGreaterThanOrEqual(1);
    const ownConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.own)
    );
    expect(ownConversation).toBeDefined();

    // Should NOT see other conversations
    const otherConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.groupMember)
    );
    expect(otherConversation).toBeUndefined();
  });

  /**
   * Test 2: Manager sees group member conversations
   */
  test('should show group member conversations to manager', async () => {
    // Login as manager
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.managerUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.managerUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to conversations
    await conversationPage.goto();

    // Get visible conversations
    const conversations = await conversationPage.getVisibleConversations();

    // Should see own conversation
    const ownConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.own)
    );
    expect(ownConversation).toBeDefined();

    // Should also see group member conversations
    const groupConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.groupMember)
    );
    expect(groupConversation).toBeDefined();

    // Should NOT see other group conversations
    const otherGroupConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.otherGroup)
    );
    expect(otherGroupConversation).toBeUndefined();
  });

  /**
   * Test 3: Tenant admin sees all tenant conversations
   */
  test('should show all tenant conversations to tenant admin', async () => {
    // Login as tenant admin
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.adminUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.adminUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to conversations
    await conversationPage.goto();

    // Get visible conversations
    const conversations = await conversationPage.getVisibleConversations();

    // Should see all conversations
    expect(conversations.length).toBeGreaterThanOrEqual(4);

    const ownConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.own)
    );
    expect(ownConversation).toBeDefined();

    const groupConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.groupMember)
    );
    expect(groupConversation).toBeDefined();

    const otherGroupConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.otherGroup)
    );
    expect(otherGroupConversation).toBeDefined();

    const anyConversation = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.anyTenant)
    );
    expect(anyConversation).toBeDefined();
  });

  /**
   * Test 4: Regular user cannot access group member conversation directly
   */
  test('should deny regular user from accessing group member conversation directly', async () => {
    // Login as regular user
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.regularUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.regularUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Try to access group member conversation directly
    await page.goto('/conversations/conv-group-member');

    // Should show access denied
    const accessDenied = await conversationPage.getAccessDeniedMessage();
    expect(accessDenied).toBeTruthy();
  });

  /**
   * Test 5: Manager accessing group member conversation is audited
   */
  test('should audit manager accessing group member conversation', async () => {
    // Login as manager
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.managerUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.managerUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Access group member conversation
    await conversationPage.goto();
    await conversationPage.openConversation('conv-group-member');

    // Navigate to audit log
    await auditPage.goto();
    await auditPage.filterByAction('conversation.view_others');

    // Verify audit event exists
    const events = await auditPage.getAuditEvents();
    const viewOthersEvent = events.find(
      (e) => e.action === 'conversation.view_others'
    );
    expect(viewOthersEvent).toBeDefined();
  });

  /**
   * Test 6: Unauthorized view attempt is logged
   */
  test('should log unauthorized view attempt', async () => {
    // Login as regular user
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.regularUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.regularUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Try to access group member conversation directly
    await page.goto('/conversations/conv-group-member');

    // Login as admin to check audit logs
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.adminUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.adminUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to audit log
    await auditPage.goto();
    await auditPage.filterByAction('view_others.attempted');

    // Verify unauthorized attempt was logged
    const events = await auditPage.getAuditEvents();
    const unauthorizedEvent = events.find(
      (e) => e.action === 'view_others.attempted'
    );
    expect(unauthorizedEvent).toBeDefined();
  });

  /**
   * Test 7: Visibility level indicator is shown
   */
  test('should show visibility level indicator for managers and admins', async () => {
    // Login as manager
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.managerUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.managerUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to conversations
    await conversationPage.goto();

    // Check visibility indicator on group member conversation
    const visibilityIndicator = await page.$(
      '[data-visibility-level="manager"]'
    );
    expect(visibilityIndicator).toBeDefined();
  });

  /**
   * Test 8: Search respects visibility boundaries
   */
  test('should restrict search results based on visibility boundaries', async () => {
    // Login as regular user
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.regularUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.regularUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to conversations
    await conversationPage.goto();

    // Search for group member conversation
    await conversationPage.searchConversations(
      TEST_DATA.conversations.groupMember
    );

    // Should not find it (outside visibility boundary)
    const conversations = await conversationPage.getVisibleConversations();
    const found = conversations.find((c) =>
      c.title.includes(TEST_DATA.conversations.groupMember)
    );
    expect(found).toBeUndefined();
  });

  /**
   * Test 9: Admin can export all tenant conversations
   */
  test('should allow admin to export all tenant conversations', async () => {
    // Login as tenant admin
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.adminUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.adminUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Navigate to conversations
    await conversationPage.goto();

    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-conversations-button"]');
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toContain('conversations-export');
  });

  /**
   * Test 10: Manager cannot export other group conversations
   */
  test('should prevent manager from exporting other group conversations', async () => {
    // Login as manager
    await page.goto('/auth/login');
    await page.fill(
      '[data-testid="email-input"]',
      TEST_DATA.managerUser.email
    );
    await page.fill(
      '[data-testid="password-input"]',
      TEST_DATA.managerUser.password
    );
    await page.click('[data-testid="login-button"]');

    // Try to export other group conversations
    await conversationPage.goto();
    await page.click('[data-testid="export-other-group-button"]');

    // Should show error
    const errorMessage = await page.textContent(
      '[data-testid="export-error-message"]'
    );
    expect(errorMessage).toContain('not authorized');
  });
});
