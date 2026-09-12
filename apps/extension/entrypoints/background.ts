import { defineBackground } from 'wxt/utils/define-background';
import type { PanelInboxMessage } from '@form-saathi/contracts';

// Short browser events only. The panel document owns the review; nothing the
// user is working on is kept here, because this worker is stopped at any time.
export default defineBackground(() => {
  // The toolbar button (and its configurable keyboard shortcut) is the only way
  // in. That gesture is what grants activeTab for this tab, so the panel is
  // bound to the tab the user actually asked about.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    const tabId = tab.id;
    // Not awaited: chrome.sidePanel.open() must stay inside the user gesture.
    chrome.sidePanel
      .setOptions({ tabId, path: `sidepanel.html?tab=${tabId}`, enabled: true })
      .catch(() => console.error('Form Saathi could not prepare the side panel for this tab.'));
    chrome.sidePanel.open({ tabId })
      .then(() => chrome.runtime.sendMessage({ type: 'activated', tabId } satisfies PanelInboxMessage))
      // An already open panel re-reads the page; no receiver yet is not a failure.
      .catch(() => undefined);
  });
});
