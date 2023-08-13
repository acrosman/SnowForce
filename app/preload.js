// Preload script.
const { contextBridge, ipcRenderer } = require('electron');  // eslint-disable-line

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object.
// Big hat tip: https://stackoverflow.com/a/59814127/24215.
contextBridge.exposeInMainWorld(
  'api',
  {
    send: (channel, data) => {
      // List channels to allow.
      const validSendChannels = [
        'find_text',
        'get_preferences',
        'load_schema',
        'log_message',
        'save_recipe',
        'save_schema',
        'sf_describeGlobal',
        'sf_getObjectFields',
        'sf_login',
        'sf_logout',
      ];
      if (validSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      const validReceiveChannels = [
        'current_preferences',
        'log_message',
        'response_login',
        'response_logout',
        'response_error',
        'response_list_objects',
        'response_object_schema',
        'start_find',
        'update_loader',
      ];
      if (validReceiveChannels.includes(channel)) {
        // Remove the event to avoid information leaks.
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  },
);
