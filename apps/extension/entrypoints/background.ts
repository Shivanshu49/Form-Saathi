import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    console.error('Form Saathi could not enable the toolbar side panel.');
  });
});
