// The actual module we're testing.
const ipcCalls = require('../ipcCalls');

// Provide a basic test of public elements of the module.
test('Validate exports', () => {
  // Validate the main elements of the library are here.
  expect(ipcCalls).toHaveProperty('handlers');
  expect(ipcCalls).toHaveProperty('setWindow');
  expect(ipcCalls).toHaveProperty('setPreferences');

  // Validate the handlers list is correct.
  const handlerList = [
    'load_schema',
    'log_message',
    'save_schema',
    'sf_describeGlobal',
    'sf_getObjectFields',
    'sf_login',
    'sf_logout',
  ];
  for (let i = 0; i < handlerList.length; i += 1) {
    expect(ipcCalls.handlers).toHaveProperty(handlerList[i]);
  }
});

// There are a series of internal values for the module. Ensure they are there.
// Several are assumed and leveraged in later tests.
test('Validate existence of assumed internals', () => {
  // Checking the existing of the four main variables.
  expect(ipcCalls.__get__('sfConnections')).toStrictEqual({});
  expect(ipcCalls.__get__('proposedSchema')).toStrictEqual({});
  expect(ipcCalls.__get__('mainWindow')).toBe(null);
  expect(ipcCalls.__get__('preferences')).toBe(null);
  // Make sure the resolver list exists by checking one arbitrarily selected property.
  expect(ipcCalls.__get__('typeDefaultResponses')).toHaveProperty('phone', 'fake: phone');
});

test('Check setWindow', () => {
  // The set window does no validation, so we cna set it to any object here.
  const myTestWindow = {
    testWindow: 1,
  };
  expect(ipcCalls.__get__('mainWindow')).toBe(null);
  ipcCalls.setWindow(myTestWindow);
  expect(ipcCalls.__get__('mainWindow')).toHaveProperty('testWindow', 1);
});

// A sample set of Preferences for use in this test and when testing other functions that need them.
const samplePrefs = {
  theme: 'Cyborg',
  indexes: {
    externalIds: true,
    lookups: true,
    picklists: true,
  },
  picklists: {
    type: 'enum',
    unrestricted: true,
    ensureBlanks: true,
  },
  lookups: {
    type: 'char(18)',
  },
  defaults: {
    attemptSFValues: false,
    textEmptyString: false,
    suppressReadOnly: false,
  },
};

test('Check SetPreferences', () => {
  // Send an object with a set of preferences, can use again for other testing.
  expect(ipcCalls.__get__('preferences')).toBe(null);
  ipcCalls.setPreferences(samplePrefs);
  expect(ipcCalls.__get__('preferences')).toHaveProperty('theme');
});

// Test the helper that pulls picklist values.
test('Test Picklist Value Extraction', () => {
  const sampleValues = [
    {
      active: true,
      defaultValue: false,
      label: 'Prospect',
      validFor: null,
      value: 'Prospect',
    },
    {
      active: true,
      defaultValue: false,
      label: 'Field with \' in it',
      validFor: null,
      value: 'Test\'s',
    },
    {
      active: true,
      defaultValue: false,
      label: 'Duplicate',
      validFor: null,
      value: 'Duplicate',
    },
    {
      active: true,
      defaultValue: false,
      label: 'Duplicate',
      validFor: null,
      value: 'Duplicate',
    },
  ];

  const definePicklistChoice = ipcCalls.__get__('definePicklistChoice');
  const testResult = definePicklistChoice(sampleValues);
  expect(testResult).toMatch(/random_choice/);
  expect(testResult).toMatch(/Prospect/);
  expect(testResult).toMatch(/Test's/);
  expect(testResult).toMatch(/Duplicate/);
});

test('Test extractChildren', () => {
  const exampleResponse = [
    {
      cascadeDelete: true,
      childSObject: 'JunkOldObject',
      deprecatedAndHidden: true,
      field: 'SobjectLookupValueId',
      junctionIdListNames: [],
      junctionReferenceTo: [],
      relationshipName: null,
      restrictedDelete: false,
    },
    {
      cascadeDelete: false,
      childSObject: 'Account',
      deprecatedAndHidden: false,
      field: 'ParentId',
      junctionIdListNames: [],
      junctionReferenceTo: [],
      relationshipName: 'ChildAccounts',
      restrictedDelete: false,
    },
    {
      cascadeDelete: true,
      childSObject: 'Contact',
      deprecatedAndHidden: false,
      field: 'AccountId',
      junctionIdListNames: [],
      junctionReferenceTo: [],
      relationshipName: 'Contacts',
      restrictedDelete: false,
    }];

  const extractChildren = ipcCalls.__get__('extractChildren');

  expect(extractChildren).toBeInstanceOf(Function);

  const testResult = extractChildren(exampleResponse);

  expect(testResult).toMatchObject({
    Account: {
      childSObject: 'Account',
      cascadeDelete: false,
      field: 'ParentId',
      relationshipName: 'ChildAccounts',
    },
    Contact: {
      childSObject: 'Contact',
      cascadeDelete: true,
      field: 'AccountId',
      relationshipName: 'Contacts',
    },
  });
});
