/* global $ */
// Initial interface setup using jQuery (since it's around from bootstrap anyway).
$.when($.ready).then(() => {
  // Get the current application preferences.
  window.api.send('get_preferences');

  // Hide the places for handling responses until we have some.
  $('#org-status').hide();
  $('#results-table-wrapper').hide();
  $('#results-object-viewer-wrapper').hide();

  // Setup next buttons.
  $('button.btn-next').on('click', (event) => {
    event.preventDefault();
    const tab = $(event.target).data('next');
    $(tab).tab('show');
  });

  // Setup prev buttons.
  $('button.btn-prev').on('click', (event) => {
    event.preventDefault();
    const tab = $(event.target).data('prev');
    $(tab).tab('show');
  });

  // Setup Find button.
  $('#btn-find-in-page').on('click', (event) => {
    event.preventDefault();
    let searchDir;
    // Get the search
    const searchText = $('#find-in-page-text').val().trim();

    // Trigger the search if text was provided.
    if (searchText) {
      // Set direction.
      searchDir = 'forward';
      if ($('#chk-find-direction').prop('checked')) {
        searchDir = 'back';
      }

      window.api.send('find_text', {
        text: searchText,
        direction: searchDir,
      });
    }
  });

  // Setup Object Select All
  $('#btn-select-all-objects').on('click', (event) => {
    event.preventDefault();
    $('#results-table input[type=checkbox]').prop('checked', true);
  });

  // Setup Object Select All
  $('#btn-deselect-all-objects').on('click', (event) => {
    event.preventDefault();
    $('#results-table input[type=checkbox]').prop('checked', false);
  });

  // Hide loader.
  $('#loader-indicator').hide();
});

// ============= Helpers ==============
// Simple find and replace of text based on selector.
const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

// Escapes HTML tags that may be headed to the log messages.
const escapeHTML = (html) => {
  const escape = document.createElement('textarea');
  escape.textContent = html;
  return escape.innerHTML;
};

/**
 * Displays an object as JSON in the raw response section of the interface.
 * @param {Object} responseObject The JSForce response object.
 */
const displayRawResponse = (responseObject) => {
  $('#raw-response').jsonViewer(responseObject, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
};

/**
 * Log a message to the console.
 * @param {String} context The part of the system that generated the message.
 * @param {String} importance The level of importance of the message.
 * @param {String} message The message to display.
 * @param {*} data Raw data to display in JSON viewer.
 */
function logMessage(context, importance, message, data) {
  // Create elements for display.
  const logTable = document.getElementById('consoleMessageTable');
  const row = logTable.insertRow(1);
  const mesImportance = document.createElement('td');
  const mesContext = document.createElement('td');
  const mesText = document.createElement('td');
  const mesData = document.createElement('td');

  // Add Classes.
  mesText.setAttribute('class', 'console-message');
  mesData.setAttribute('class', 'console-raw-data');

  // Set the row highlights as needed.
  switch (importance.toLowerCase()) {
    case 'error':
      row.className += 'table-danger';
      break;
    case 'warning':
    case 'warn':
      row.className += 'table-warning';
      break;
    case 'success':
      row.className += 'table-success';
      break;
    default:
      break;
  }

  // Add Text
  mesContext.innerHTML = context;
  mesImportance.innerHTML = importance;
  mesText.innerHTML = escapeHTML(message);

  // Attach Elements
  row.appendChild(mesImportance);
  row.appendChild(mesContext);
  row.appendChild(mesText);
  row.appendChild(mesData);

  if (data) {
    displayRawResponse(data);
    $(mesData).jsonViewer(data, {
      collapsed: true,
      rootCollapsable: false,
      withQuotes: true,
      withLinks: true,
    });
  }
}

/**
 * Returns the user name for the OrgId provided if in connection list, otherwise blank.
 * @param {String} orgId OrgId from org in connection select
 * @returns User name for requested org
 */
function fetchOrgUser(orgId) {
  const orgRecord = document.getElementById(`sforg-${orgId}`);
  if (orgRecord === null) {
    return '';
  }
  return orgRecord.text;
}

/**
 * From a DOM element containing table rows to extract a column from.
 * @param {domElement} ele A dom element containing table rows.
 * @param {Integer} columnIndex The integer of the column to extract.
 * @returns An array of table cells (td) from requested column.
 */
function getTableColumn(ele, columnIndex) {
  const col = [];
  const rows = ele.getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i += 1) {
    col.push(rows[i].cells[columnIndex]);
  }

  return col;
}

/**
 * Sort the Object table by column. Uses a decorate, sort, un-decorate approach.
 * @param {String} sortProperty The name of the property to sort the data by.
 * @param {String} direction The sorting direction: ASC or DESC.
 * @param {String} orgId The Id of the org whose objects are being sorted.
 */
function sortObjectTable(sortProperty, direction = 'ASC', orgId = '') {
  const table = document.getElementById('results-table');
  const tableBody = table.getElementsByTagName('tbody')[0];
  const dir = direction.toUpperCase();
  const sortData = [];
  const renderData = [];
  const selected = [];

  // Extract the table's Select cells.
  const column = getTableColumn(tableBody, 0);

  // Build a list to sort keyed by the property in question.
  column.forEach((cell) => {
    const rowData = JSON.parse(cell.dataset.rowData);
    if (cell.firstChild.checked) {
      selected.push(rowData.name);
    }
    // For the named properties, we just use those.
    if (sortProperty !== 'Select') {
      sortData.push([rowData[sortProperty], rowData]);
    } else {
      // For the select we need the checked status, which is now
      // membership in the selected list.
      sortData.push([selected.includes(rowData.name), rowData]);
    }
  });

  // Pre-sort the selected list incase we need it in a sec.
  selected.sort();

  // Sort the list.
  sortData.sort((a, b) => {
    // Assume everything is equal.
    let order = 0;
    // For the non-selects we just sort by the first array element.
    if (sortProperty !== 'Select') {
      if (a[0] > b[0]) {
        order = 1;
      }
      if (a[0] < b[0]) {
        order = -1;
      }
    } else {
      // For the selects, we sort by the first array element, and the name.
      // When a is checked and b is not, a wins.
      if (a[0] && !b[0]) {
        order = 1;
      }
      // When a is checked and a is not, b wins.
      if (!a[0] && b[0]) {
        order = -1;
      }
      // When both are checked or unchecked, name sort.
      if ((a[0] && b[0]) || (!a[0] && !b[0])) {
        if (a[1].name < b[1].name) {
          order = 1;
        }
        if (a[1].name > b[1].name) {
          order = -1;
        }
      }
    }
    return order;
  });

  if (dir === 'DESC') {
    sortData.reverse();
  }

  // Un-decorate the list for rendering.
  sortData.forEach((row) => {
    renderData.push(row[1]);
  });

  // Trigger re-render of the table.
  // This is a circular reference so no lint error for you.
  // eslint-disable-next-line no-use-before-define
  displayObjectList(orgId, renderData, selected, true, sortProperty, dir);
}

/**
 * Attaches the DOM element for a table header element attached an existing table.
 * @param {Object} headerRow The DOM element to attach the new header to.
 * @param {String} labelText The text for the element.
 * @param {String} scope The scope attribute to use for the element, defaults to col.
 * @returns The new header element created.
 */
const generateTableHeader = (headerRow, labelText, scope = 'col') => {
  const newHeader = document.createElement('th');
  newHeader.setAttribute('scope', scope);
  const textNode = document.createTextNode(labelText);
  newHeader.appendChild(textNode);
  headerRow.appendChild(newHeader);
  return newHeader;
};

/**
 * Attaches a new table cell to an existing row.
 * @param {Object} tableRow The DOM element to attach the new element to.
 * @param {object} content The content to put in the cell.
 * @param {boolean} isText Defines if the content should be treated as text or a sub-element.
 * @param {Integer} position The index to insert to new cell. Default -1 appends to the end.
 */
const generateTableCell = (tableRow, content, isText = true, position = -1) => {
  let contentNode;

  // Create the content of the cell as text or a DOM element.
  if (isText) {
    contentNode = document.createTextNode(content);
  } else {
    contentNode = content;
  }
  const cellNode = document.createElement('td');
  cellNode.appendChild(contentNode);

  // Add the new cell to the row using position if given.
  if (position === -1) {
    tableRow.appendChild(cellNode);
  } else {
    tableRow.insertBefore(cellNode, tableRow.children[position]);
  }

  return cellNode;
};

const showLoader = (message) => {
  $('#loader-indicator .loader-message').text(message);
  $('#loader-indicator').show();
  $('#message-wrapper').hide();
};

const hideLoader = () => {
  $('#loader-indicator').hide();
  $('#message-wrapper').show();
};

const updateMessage = (message) => {
  $('#message-wrapper').show();
  const messageArea = document.getElementById('results-message-only');
  messageArea.innerText = message;
};

/**
 * Inserts a node into another node, sorted by sortValue using the provided
 * pattern to select the sort value. Sort values are assumed to be in a data-name
 * attribute of insertedDom (and all other inserted elements). This uses an insert
 * sort approach, and assumes the existing list is empty or sorted.
 * @param {*} wrapperDom The DOM element which will contain the other.
 * @param {*} insertDom The DOM element to insert into the wrapper.
 * @param {*} sortValue The value to use for sorting.
 * @param {*} selectorPattern The selector to use for finding the value in previous elements.
 */
const insertSorted = (wrapperDom, insertDom, sortValue, selectorPattern) => {
  const elementList = wrapperDom.querySelectorAll(selectorPattern);

  if (elementList.length === 0) {
    wrapperDom.appendChild(insertDom);
    return;
  }

  for (let i = 0; i < elementList.length; i += 1) {
    if (elementList[i].dataset.name.localeCompare(sortValue) > -1) {
      wrapperDom.insertBefore(insertDom, elementList[i]);
      return;
    }
  }
};

/**
 * Insert an object's schema into the accordion of objects.
 * @param {String} objectName
 * @param {*} fieldSchema
 */
const insertObjectSchema = (objectName, fieldSchema) => {
  // Grab DOM targets
  const wrapper = document.getElementById('objectAccordion');
  const objTemplate = document.getElementById('object-detail-template');
  const fldTemplate = document.getElementById('field-detail-template');

  // Clone and prep the Object card.
  const objectDetails = objTemplate.content.cloneNode(true);
  const objectCard = objectDetails.querySelector('div.card');
  const header = objectDetails.querySelector('.card-header');
  const btn = header.querySelector('button.header-trigger');
  const details = objectDetails.querySelector('.object-details');
  header.id = `object-detail-header-${objectName}`;
  objectCard.dataset.name = objectName;
  details.id = `object-details-${objectName}`;
  btn.dataset.target = `#${details.id}`;
  btn.textContent = objectName;

  // Clone and prep the fields and field elements.

  // Insert new structures.
  insertSorted(wrapper, objectDetails, objectName, 'div.card');
};

// ================ Response Handlers =================

/**
 * Handles interface adjustments after login is complete.
 * @param {*} responseData The data sent from the main process.
 */
const handleLogin = (responseData) => {
  // Add the new connection to the list of options.
  const opt = document.createElement('option');
  opt.value = responseData.response.organizationId;
  opt.innerHTML = responseData.request.username;
  opt.id = `sforg-${opt.value}`;
  document.getElementById('active-org').appendChild(opt);

  // Shuffle what's shown.
  document.getElementById('org-status').style.display = 'block';
  replaceText('active-org-id', responseData.response.organizationId);
  replaceText('login-response-message', responseData.message);

  // Enable the button to fetch object list.
  $('#btn-fetch-objects').prop('disabled', false);
};

/**
 * Displays the list of objects from a Global describe query.
 * @param {String} orgId The Id for the org queried.
 * @param {Object} sObjectData The results from JSForce to display.
 * @param {Array} selected The list of objects to set as selected.
 * @param {boolean} sorted When true, the list will be rendered in the order provided,
 *  otherwise it will sort selected first.
 * @param {String} sortedColumn The name of the column the data is sorted by to set label.
 */
const displayObjectList = (orgId, sObjectData, selected, sorted = false, sortedColumn = 'Select', sortedDirection = 'ASC') => {
  // Define  columns to display.
  const displayColumns = [
    'label',
    'name',
  ];

  const orgUser = fetchOrgUser(orgId);
  updateMessage(`Object List Retrieved for ${orgUser}`);

  // Display area.
  // @todo: remove jquery use.
  $('#results-table-wrapper').show();
  $('#results-object-viewer-wrapper').hide();
  $('#results-summary-count').text('Loading objects...');

  // Get the table.
  const resultsTable = document.getElementById('results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.lastChild);
  }

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');

  // Add the header
  let th;
  let nextSort = 'ASC';

  // First add the column for the select boxes.
  th = generateTableHeader(headRow, 'Select');
  if (sortedColumn === 'Select') {
    th.dataset.sortDirection = sortedDirection;
    if (sortedDirection === 'ASC') {
      th.classList.add('bi', 'bi-arrow-down');
      th.ariaLabel = 'Select sorted selected first';
      nextSort = 'DESC';
    } else {
      th.classList.add('bi', 'bi-arrow-up');
      th.ariaLabel = 'Select sorted selected last';
    }
  }

  // Since we go on to use nextSort in the loop below the reference
  // that gets passed here would be bad, so switch back to actual string.
  if (nextSort === 'DESC') {
    th.addEventListener('click', () => {
      sortObjectTable('Select', 'DESC', orgId);
    });
  } else {
    th.addEventListener('click', () => {
      sortObjectTable('Select', 'ASC', orgId);
    });
  }

  // Add all other columns.
  for (let i = 0; i < displayColumns.length; i += 1) {
    nextSort = 'ASC';
    th = generateTableHeader(headRow, displayColumns[i]);
    if (sortedColumn === displayColumns[i]) {
      th.dataset.sortDirection = sortedDirection;
      if (sortedDirection === 'ASC') {
        th.classList.add('bi', 'bi-arrow-up');
        th.ariaLabel = `${displayColumns[i]} sorted ascending.`;
        nextSort = 'DESC';
      } else {
        th.classList.add('bi', 'bi-arrow-down');
        th.ariaLabel = `${displayColumns[i]} sorted descending.`;
      }
    }

    // Yes, this looks odd, but it makes the linter happy. Which is good
    // cause it's easy to make a confusing error here and pass the last
    // value instead of the current value.
    if (nextSort === 'DESC') {
      th.addEventListener('click', () => {
        sortObjectTable(displayColumns[i], 'DESC', orgId);
      });
    } else {
      th.addEventListener('click', () => {
        sortObjectTable(displayColumns[i], 'ASC', orgId);
      });
    }
  }

  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data in two passes: recommended objects for selection, then all the others.
  // Gives us a default sort in O(n).
  let dataRow;
  const tBody = document.createElement('tbody');
  const displayed = [];
  let checkCell;
  let selectCell;
  let objCount = 0;

  // If not sorted yet, run a pass to rendered selected objects first
  if (!sorted) {
    sObjectData.forEach((sObj) => {
      const { name } = sObj;
      if (selected.includes(name)) {
        displayed.push(sObj.name);
        dataRow = document.createElement('tr');

        // Generate a checkbox
        checkCell = document.createElement('input');
        checkCell.type = 'checkbox';
        checkCell.checked = true;
        checkCell.dataset.objectName = sObj.name;
        selectCell = generateTableCell(dataRow, checkCell, false);

        // Add the details
        for (let j = 0; j < displayColumns.length; j += 1) {
          generateTableCell(dataRow, sObj[displayColumns[j]]);
        }

        // Add the data for this row to the select cell for easy access during sorting.
        selectCell.dataset.rowData = JSON.stringify(sObj);

        // Add the new row to the table body.
        tBody.appendChild(dataRow);
        objCount += 1;
      }
    });
  }

  // Render all objects not already on the list. If the list is sorted this will be
  // all objects. If the list is unsorted the selected objects were already rendered.
  sObjectData.forEach((sObj) => {
    if (!displayed.includes(sObj.name) && sObj.createable) {
      dataRow = document.createElement('tr');

      // Generate a checkbox
      checkCell = document.createElement('input');
      checkCell.type = 'checkbox';
      checkCell.dataset.objectName = sObj.name;
      checkCell.checked = selected.includes(sObj.name);
      selectCell = generateTableCell(dataRow, checkCell, false);
      // Add the details
      for (let j = 0; j < displayColumns.length; j += 1) {
        generateTableCell(dataRow, sObj[displayColumns[j]]);
      }

      // Add the data for this row to the select cell for easy access during sorting.
      selectCell.dataset.rowData = JSON.stringify(sObj);

      // Add to the end of the table.
      tBody.appendChild(dataRow);
      objCount += 1;
    }
  });

  // Add the whole table body to the table itself.
  resultsTable.appendChild(tBody);

  $('#results-summary-count').text(`Your org contains ${objCount} creatable objects`);

  // Enable the button to fetch object list.
  $('#btn-fetch-details').prop('disabled', false);

  // Interface update complete, hide the loader.
  hideLoader();
};

/**
 * Displays the field schema for an object for user edits.
 * @param {String} objectName The name of the object returned.
 * @param {*} schema the built-out schema from main thread.
 * @param {boolean} complete is true when this is the last object, and the schema is complete.
 * @param {String} orgId The org ID for the schema.
 */
const displayObjectSchema = (objectName, schema, complete, orgId) => {
  showLoader(`Rendering ${objectName}`);
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';

  insertObjectSchema(objectName, schema);

  // If we know the org user, show it, otherwise assume this was loaded locally.
  let orgUser = fetchOrgUser(orgId);
  if (orgUser === '') {
    orgUser = 'local file';
  }

  if (complete) {
    updateMessage(`Proposed schema of all objects from ${orgUser} ready for review.`);
  } else {
    updateMessage(`Proposed schema of ${objectName} from ${orgUser} ready for review.`);
  }

  // TODO: Convert to native JS
  $('#btn-generate-recipe').prop('disabled', false);
  $('#btn-save-sf-schema').prop('disabled', false);
  $('#nav-schema-tab').tab('show');
  hideLoader();
};

// ========= Messages to the main process ===============
// Login
document.getElementById('login-trigger').addEventListener('click', () => {
  showLoader('Attempting Login');
  window.api.send('sf_login', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    token: document.getElementById('login-token').value,
    url: document.getElementById('login-url').value,
  });
});

// Logout
document.getElementById('logout-trigger').addEventListener('click', () => {
  const { value } = document.getElementById('active-org');
  window.api.send('sf_logout', {
    org: value,
  });
  // Remove from interface:
  const selectObject = document.getElementById('active-org');
  for (let i = 0; i < selectObject.length; i += 1) {
    if (selectObject.options[i].value === value) {
      selectObject.remove(i);
    }
  }
  document.getElementById('org-status').style.display = 'none';
});

// Fetch Org Objects
document.getElementById('btn-fetch-objects').addEventListener('click', () => {
  showLoader('Loading Object List');
  window.api.send('sf_describeGlobal', {
    org: document.getElementById('active-org').value,
  });
});

// Fetch Object Field lists
document.getElementById('btn-fetch-details').addEventListener('click', () => {
  const activeCheckboxes = document.querySelectorAll('input[type=checkbox]:checked');
  const selectedObjects = [];
  for (let i = 0; i < activeCheckboxes.length; i += 1) {
    selectedObjects.push(activeCheckboxes[i].dataset.objectName);
  }
  showLoader('Loading Object Fields');
  window.api.send('sf_getObjectFields', {
    org: document.getElementById('active-org').value,
    objects: selectedObjects,
  });
});

// Add Trigger schema save process.
document.getElementById('btn-save-sf-schema').addEventListener('click', () => {
  window.api.send('save_schema');
});

// Add trigger for load schema process.
document.getElementById('btn-load-sf-schema').addEventListener('click', () => {
  window.api.send('load_schema');
});

// ===== Response handlers from IPC Messages to render context ======
// Login response.
window.api.receive('response_login', (data) => {
  hideLoader();
  if (data.status) {
    logMessage('Salesforce', 'Success', data.message, data.response);
    updateMessage('Login Successful');
    handleLogin(data, data.status);
  } else {
    logMessage('Salesforce', 'Error', data.message, data.response);
    displayRawResponse(data);
    updateMessage('Login Error');
  }
});

// Logout Response.
window.api.receive('response_logout', (data) => {
  logMessage('Salesforce', 'Info', 'Log out complete', data);
  updateMessage('Salesforce connection removed.');
});

// Generic Response.
window.api.receive('response_error', (data) => {
  hideLoader();
  logMessage(data.message, 'Error', data.response, data);
});

// Response after fetching sObject Schemas
window.api.receive('response_object_schema', (data) => {
  logMessage('Schema', 'Success', 'Draft schema built', data);
  displayObjectSchema(
    data.response.objectName,
    data.response.objectSchema,
    data.status,
    data.request?.org,
  );
});

// List Objects From Global Describe.
window.api.receive('response_list_objects', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'block';
  if (data.status) {
    logMessage('Salesforce', 'Info', `Retrieved ${data.response.sobjects.length} SObjects from Salesforce`, data);
    displayObjectList(
      data.request?.org,
      data.response.sobjects,
      data.response.recommended,
    );
  } else {
    logMessage('Salesforce', 'Error', 'Error while retrieving object listing.', data);
  }
});

// Process a log message.
window.api.receive('log_message', (data) => {
  logMessage(data.sender, data.channel, data.message);
});

// Respond to updates to the preferences.
window.api.receive('current_preferences', (data) => {
  // Update the theme:
  const cssPath = `../node_modules/bootswatch/dist/${data.theme.toLowerCase()}/bootstrap.min.css`;
  document.getElementById('css-theme-link').href = cssPath;
});

// Start the find process by activating the controls and scrolling there.
window.api.receive('start_find', () => {
  const findBox = document.getElementById('find-in-page-text');
  findBox.scrollIntoView();
  findBox.focus();
});

// Update the current loader message.
window.api.receive('update_loader', (data) => {
  showLoader(data.message);
});
