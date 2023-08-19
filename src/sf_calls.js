const fs = require('fs');
const path = require('path');
const electron = require('electron'); // eslint-disable-line
const jsforce = require('jsforce');
const YAML = require('yaml');

// Get the dialog library from Electron
const { dialog } = electron;

const sfConnections = {};
let mainWindow = null;
let proposedSchema = {};
let preferences = null;

// Baseline for field conversions by type and naming conventions.
// Snowfakery formula syntax overlaps with JS templates. Disable eslint rule
// since it doesn't make sense in this context.
/* eslint-disable no-template-curly-in-string */
// Default proposals by type
const typeDefaultResponses = {
  base64: false, // Need a better response
  boolean: 'random_choice: \n  - ${{ \'On\'}} \n  - ${{ \'Off\'}}',
  byte: '${{ fake.Binary(length = 4) }}',
  calculated: false, // There is no valid response for these fields
  comboBox: false,
  currency: `random_number:
  min: 1
  max: 10000
`,
  date: `date_between:
  start_date: -1y
  end_date: +1M`,
  datetime: `datetime_between:
  start_date: 1970-12-31 11:59:00
  end_date: now`,
  double: `random_number:
  min: 0
  max: 100`,
  email: 'fake: email',
  encryptedstring: '${{fake.Sha1(raw_output=False)}}',
  id: false,
  int: `random_number:
  min: 0
  max: 100`,
  long: `random_number:
  min: 0
  max: 10000`,
  masterrecord: false,
  multipicklist: false,
  percent: `random_number:
  min: 1
  max: 100`,
  phone: 'fake: phone',
  picklist: false,
  reference: false,
  string: '${{fake.Sentence(nb_words=10)}}',
  textarea: '${{fake.Paragraph(nb_sentences=5)}}',
  time: '${{fake.Time}}',
  url: '${{fake.Uri}}',
};

// Standard object common fields
const objectDefaultResponses = {
  Account: {
    Name: 'fake: company',
  },
  Contact: {
    FirstName: 'fake: first_name',
    LastName: 'fake: last_name',
    Salutation: `random_choice:
  Mr.: 40%
  Ms.: 40%
  Dr.: 10%
  Prof.: 10%`,
  },
};
/* eslint-enable no-template-curly-in-string */

// Different common packages beg for different sets of Standard objects as likely to be used.
const standardObjectsByNamespace = {
  npsp: [
    'Account',
    'Contact',
    'Campaign',
    'CampaignMember',
    'Case',
    'ContentNote',
    'ContentDocumentLink',
    'Document',
    'Opportunity',
    'OpportunityContactRole',
    'RecordType',
    'Task',
    'User',
  ],
  eda: [
    'Account',
    'Contact',
    'Campaign',
    'CampaignMember',
    'Case',
    'ContentNote',
    'ContentDocumentLink',
    'Document',
    'Lead',
    'RecordType',
    'Task',
    'User',
  ],
  other: [
    'Account',
    'Contact',
    'Campaign',
    'CampaignMember',
    'Case',
    'ContentNote',
    'ContentDocumentLink',
    'Document',
    'Lead',
    'Opportunity',
    'OpportunityContactRole',
    'Order',
    'OrderItem',
    'PriceBook2',
    'Product2',
    'RecordType',
    'Task',
    'User',
  ],
};

const auditFields = [
  'CreatedDate',
  'CreatedById',
  'LastModifiedDate',
  'LastModifiedById',
  'SystemModstamp',
  'LastActivityDate',
  'LastViewedDate',
  'LastReferencedDate',
];

/**
 * Sets the window being used for the interface. Responses are sent to this window.
 * @param {*} window The ElectronJS window in use.
 */
const setWindow = (window) => {
  mainWindow = window;
};

/**
 * Sets the preferences for use in generating the schema.
 * @param {*} prefs The current application preference object to use.
 */
const setPreferences = (prefs) => {
  preferences = prefs;
};

/**
 * Send a log message to the console window.
 * @param {String} title  Message title or sender
 * @param {String} channel  Message category
 * @param {String} message  Message
 * @returns True (always).
 */
const logMessage = (title, channel, message) => {
  mainWindow.webContents.send('log_message', {
    sender: title,
    channel,
    message,
  });
  return true;
};

/**
 * Updates the loader message in the interface.
 * @param {String} message
 */
const updateLoader = (message) => {
  mainWindow.webContents.send('update_loader', { message });
};

/**
 * Generates a choice statement to use with Picklists
 * @param {Array} valueList list of values from a Salesforce describe response.
 * @returns Snowfakery random_choice string for the picklist.
 */
const definePicklistChoice = (valueList) => {
  let values = [];
  let val;
  // Extract all values and de-dup list
  for (let i = 0; i < valueList.length; i += 1) {
    val = valueList[i].value;
    values.push(val);
  }
  values = [...new Set(values)];

  // Generate the Random_choice string.
  let statement = 'random_choice:\n';
  for (let i = 0; i < values.length; i += 1) {
    statement += `  - ${values[i]}\n`;
  }

  return statement;
};

/**
 * Generates the details of all the fields in the schema.
 * @param {String} objectName The name of the object the fields define.
 * @param {*} fieldList An array of fields.
 * @returns An collection of proposed Snowfakery line for this field.
 */
const buildFields = (objectName, fieldList) => {
  const proposedFakers = {};
  let fakerProposal;
  let isReadOnly = false;
  let isAudit = false;

  const objectOverrideList = Object.getOwnPropertyNames(objectDefaultResponses);
  let fldList;

  for (let f = 0; f < fieldList.length; f += 1) {
    // Determine if this is a readonly or audit field.
    isReadOnly = fieldList[f].calculated || (!fieldList[f].updateable && !fieldList[f].createable);
    isAudit = auditFields.includes(fieldList[f].name);

    // Add field to schema if it's an Id, or allowed by preferences.
    if (fieldList[f].type === 'id'
      || (
        !(preferences.defaults.suppressReadOnly && isReadOnly)
        && !(preferences.defaults.suppressAudit && isAudit)
      )
    ) {
      // Get a default faker when possible.
      fakerProposal = typeDefaultResponses[fieldList[f].type];

      // For Picklists we need to generate statement.
      if (fieldList[f].type === 'picklist' || fieldList[f].type === 'multipicklist') {
        fakerProposal = definePicklistChoice((fieldList[f].picklistValues));
      }

      // Check for object/field specific overrides.
      if (objectName in objectOverrideList) {
        fldList = Object.getOwnPropertyNames(objectDefaultResponses[objectName]);
        if (fieldList[f].name in fldList) {
          fakerProposal = objectDefaultResponses[objectName][fieldList[f].name];
        }
      }

      proposedFakers[fieldList[f].name] = fakerProposal;
    }
  }
  return proposedFakers;
};

/**
 * Opens a dialog and starts the schema load process with the result.
 */
const loadSchemaFromFile = () => {
  const dialogOptions = {
    title: 'Load Schema',
    message: 'Load schema from JSON previously saved by snowForce',
    filters: [
      { name: JSON, extensions: ['json'] },
    ],
    properties: ['openFile'],
  };

  dialog.showOpenDialog(mainWindow, dialogOptions).then((response) => {
    if (response.canceled) { return; }

    const fileName = response.filePaths[0];

    fs.readFile(fileName, (err, data) => {
      if (err) {
        logMessage('File', 'Error', `Unable to load requested file: ${err.message}`);
        return;
      }

      // @TODO: Validate that schema is in a useable form.

      proposedSchema = JSON.parse(data);
      logMessage('File', 'Info', `Loaded schema from file: ${fileName}`);

      // Send Schema to interface for review.
      mainWindow.webContents.send('response_schema', {
        status: false,
        message: `Loaded schema from ${fileName}`,
        response: {
          schema: proposedSchema,
        },
      });
    });
  });
};

/**
 * Reviews an org's list of objects to guess the org type
 * @param {Object} sObjectList The list of objects for the org.
 * @returns {String} org type. One of npsp, eda, other.
 */
const sniffOrgType = (sObjectList) => {
  const namespaces = {
    npsp: 'npsp',
    npe: 'npsp',
    hed: 'eda',
  };

  const keys = Object.getOwnPropertyNames(namespaces);
  for (let i = 0; i < sObjectList.length; i += 1) {
    for (let j = 0; j < keys.length; j += 1) {
      if (sObjectList[i].name.startsWith(keys[j])) {
        return namespaces[keys[j]];
      }
    }
  }
  return 'other';
};

/**
 * Review previously loaded object list and send to the Render thread a recommended
 * list of objects to select.
 * @param {Array} objectResult The list of objects from a global describe of the org.
 * @returns an array of object name to default select.
 */
const recommendObjects = (objectResult) => {
  const orgType = sniffOrgType(objectResult);
  const suggestedStandards = standardObjectsByNamespace[orgType];
  const recommended = [];
  objectResult.forEach((obj) => {
    if (suggestedStandards.includes(obj.name) || obj.name.endsWith('__c')) {
      recommended.push(obj.name);
    }
  });
  return recommended;
};

/**
 * Open a save dialogue and write settings to a file.
 */
const saveSchemaToFile = () => {
  const dialogOptions = {
    title: 'Save Schema To',
    message: 'Create File',
  };

  dialog.showSaveDialog(mainWindow, dialogOptions).then((response) => {
    if (response.canceled) { return; }

    let fileName = response.filePath;

    if (path.extname(fileName).toLowerCase() !== '.json') {
      fileName = `${fileName}.json`;
    }

    fs.writeFile(fileName, JSON.stringify(proposedSchema), (err) => {
      if (err) {
        logMessage('Save', 'Error', `Unable to save file: ${err}`);
      } else {
        logMessage('Save', 'Info', `Schema saved to ${fileName}`);
      }
    });
  }).catch((err) => {
    logMessage('Save', 'Error', `Saved failed after dialog: ${err}`);
  });
};

/**
 * Open a save dialogue and write recipe to a file.
 * @param {YAML.Document} recipeDocument The object structure of the recipe file to write.
 */
const saveRecipeFile = (recipeDocument) => {
  const dialogOptions = {
    title: 'Save Recipe to File',
    message: 'Create Recipe',
  };

  dialog.showSaveDialog(mainWindow, dialogOptions).then((response) => {
    if (response.canceled) { return; }

    let fileName = response.filePath;

    if (path.extname(fileName).toLowerCase() !== '.yml') {
      fileName = `${fileName}.yml`;
    }

    fs.writeFile(fileName, recipeDocument.toString(), (err) => {
      if (err) {
        logMessage('Save', 'Error', `Unable to save file: ${err}`);
      } else {
        logMessage('Save', 'Info', `Recipe saved to ${fileName}`);
      }
    });
  }).catch((err) => {
    logMessage('Save', 'Error', `Saved failed after dialog: ${err}`);
  });
};

/**
 * List of remote call handlers for using with IPC.
 */
const handlers = {
  /**
   * Login to an org using password authentication.
   * @param {*} event Standard message event.
   * @param {*} args Login credentials from the interface.
   */
  sf_login: (event, args) => {
    const conn = new jsforce.Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: args.url,
    });

    let { password } = args;
    if (args.token !== '') {
      password = `${password}${args.token}`;
    }

    conn.login(args.username, password).then(
      (userInfo) => {
        // Since we send the args back to the interface, it's a good idea
        // to remove the security information.
        args.password = '';
        args.token = '';

        // Now you can get the access token and instance URL information.
        // Save them to establish connection next time.
        logMessage(event.sender.getTitle(), 'Info', `Connection Org ${userInfo.organizationId} for User ${userInfo.id}`);

        // Save the next connection in the global storage.
        sfConnections[userInfo.organizationId] = {
          instanceUrl: conn.instanceUrl,
          accessToken: conn.accessToken,
        };

        mainWindow.webContents.send('response_login', {
          status: true,
          message: 'Login Successful',
          response: userInfo,
          limitInfo: conn.limitInfo,
          request: args,
        });
      },
      (err) => {
        mainWindow.webContents.send('response_login', {
          status: false,
          message: 'Login Failed',
          response: err,
          limitInfo: conn.limitInfo,
          request: args,
        });
      },
    );
  },
  /**
   * Logout of a specific Salesforce org.
   * @param {*} event Standard message event.
   * @param {*} args The connection to disable.
   */
  sf_logout: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    const fail = (err) => {
      mainWindow.webContents.send('response_logout', {
        status: false,
        message: 'Logout Failed',
        response: `${err} `,
        limitInfo: conn.limitInfo,
        request: args,
      });
      logMessage(event.sender.getTitle(), 'Error', `Logout Failed ${err} `);
    };
    const success = () => {
      // now the session has been expired.
      mainWindow.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      sfConnections[args.org] = null;
    };
    conn.logout.then(success, fail);
  },
  /**
   * Run a global describe.
   * @param {*} event Standard message event.
   * @param {*} args Message args with org to use.
   * @returns True.
   */
  sf_describeGlobal: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    const fail = (err) => {
      mainWindow.webContents.send('response_error', {
        status: false,
        message: 'Describe Global Failed',
        response: `${err} `,
        limitInfo: conn.limitInfo,
        request: args,
      });
    };
    const success = (result) => {
      // Send records back to the interface.
      logMessage('Fetch Objects', 'Info', `Used global describe to list ${result.sobjects.length} SObjects.`);
      result.recommended = recommendObjects(result.sobjects);
      mainWindow.webContents.send('response_list_objects', {
        status: true,
        message: 'Describe Global Successful',
        response: result,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    };

    conn.describeGlobal().then(success, fail);
  },
  /**
   * Get a list of all fields on a provided list of objects.
   * @param {*} event Standard message event.
   * @param {*} args Arguments from the interface.
   */
  sf_getObjectFields: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    let completedObjects = 0;
    const allObjects = {};

    // Reset the proposed schema back to baseline.
    proposedSchema = {};

    // Log status
    logMessage('Schema', 'Info', `Fetching schema for ${args.objects.length} objects`);
    updateLoader('Starting Object Describe Fetch');

    args.objects.forEach((obj) => {
      if (obj !== undefined) {
        conn.sobject(obj).describe().then((response) => {
          completedObjects += 1;
          proposedSchema[response.name] = buildFields(response.name, response.fields);
          allObjects[response.name] = response;
          updateLoader(`Processed ${completedObjects} of ${args.objects.length} Object Describes`);
          // Send Object's Schema to interface for review.
          mainWindow.webContents.send('response_object_schema', {
            status: completedObjects === args.objects.length,
            message: `Processed ${response.name}`,
            response: {
              objectName: response.name,
              objectSchema: proposedSchema[response.name],
            },
            limitInfo: conn.limitInfo,
            request: args,
          });
        }, (err) => {
          logMessage('Field Fetch', 'Error', `Error loading describe for ${obj}: ${err} `);
        });
      }
    });
  },
  /**
   * Save the recipe to a file.
   * @param {*} event Standard message event.
   * @param {*} args Arguments from the interface.
   */
  save_recipe: (event, args) => {
    // TODO: Break this function into a class that wraps Document and does all the things needed.
    const recipeFile = new YAML.Document([]);

    recipeFile.commentBefore = 'Generated Snowfakery Recipe. Please review and modify before use.';
    const objectNames = Object.getOwnPropertyNames(args.objects);
    let fieldDetails = {};
    let fieldNames = [];
    let node;
    for (let i = 0; i < objectNames.length; i += 1) {
      fieldNames = Object.getOwnPropertyNames(args.objects[objectNames[i]].fields);
      fieldDetails = {};
      for (let j = 0; j < fieldNames.length; j += 1) {
        fieldDetails[fieldNames[j]] = args.objects[objectNames[i]].fields[fieldNames[j]];
      }
      node = recipeFile.createNode({
        object: objectNames[i],
        count: args.objects[objectNames[i]].count,
        fields: fieldDetails,
      });
      recipeFile.add(node);
    }

    saveRecipeFile(recipeFile);
  },
  /**
   * Send a log message to message console window.
   * @param {*} event Standard message event.
   * @param {*} args Log arguments.
   * @returns true.
   */
  log_message: (event, args) => {
    mainWindow.webContents.send('log_message', {
      sender: args.sender,
      channel: args.channel,
      message: args.message,
    });
    return true;
  },
  /**
   * Load a previously saved Schema from a file.
   */
  load_schema: () => {
    loadSchemaFromFile();
  },
  /**
   * Save the current schema settings to a file.
   */
  save_schema: () => {
    saveSchemaToFile();
  },
};

// Export setup.
exports.handlers = handlers;
exports.setWindow = setWindow;
exports.setPreferences = setPreferences;
