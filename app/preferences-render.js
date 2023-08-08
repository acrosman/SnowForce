document.addEventListener('DOMContentLoaded', () => {
  // Get current preference settings:
  window.api.send('preferences_load');

  // Add save listener for preference window.
  document.getElementById('btn-preferences-save').addEventListener('click', () => {
    window.api.send('preferences_save', {
      theme: document.getElementById('setting-theme-select').value,
      picklists: {
        unrestricted: document.getElementById('picklist-restricted').checked,
        allowBlanks: document.getElementById('picklist-blank').checked,
      },
      defaults: {
        suppressReadOnly: document.getElementById('hide-readonly-fields').checked,
        suppressAudit: document.getElementById('hide-audit-fields').checked,
      },
    });
    window.api.send('preferences_close');
  });

  // Add click to close listener for preference window.
  document.getElementById('btn-preferences-close').addEventListener('click', () => {
    window.api.send('preferences_close');
  });

  // Add escape key listener for closing window.
  document.onkeyup = (evt) => {
    const event = evt || window.event;
    let isEscape = false;
    if ('key' in evt) {
      isEscape = (event.key === 'Escape' || event.key === 'Esc');
    }
    if (isEscape) {
      window.api.send('preferences_close');
    }
  };
});

window.api.receive('preferences_data', (data) => {
  // Set Window theme:
  const cssPath = `../node_modules/bootswatch/dist/${data.theme.toLowerCase()}/bootstrap.min.css`;
  document.getElementById('css-theme-link').href = cssPath;

  // Set Values:
  document.getElementById('setting-theme-select').value = data.theme;
  document.getElementById('picklist-restricted').checked = data.picklists.unrestricted;
  document.getElementById('picklist-blank').checked = data.picklists.allowBlanks;
  document.getElementById('hide-readonly-fields').checked = data.defaults.suppressReadOnly;
  document.getElementById('hide-audit-fields').checked = data.defaults.suppressAudit;
});
