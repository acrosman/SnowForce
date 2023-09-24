// The actual module we're testing.
const sfcalls = require('../ipcCalls');

// Provide a basic test of public elements of the module.
test('Validate exports', () => {
  // Validate the main elements of the library are here.
  expect(sfcalls).toHaveProperty('handlers');
  expect(sfcalls).toHaveProperty('setWindow');
  expect(sfcalls).toHaveProperty('setPreferences');

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
    expect(sfcalls.handlers).toHaveProperty(handlerList[i]);
  }
});

// There are a series of internal values for the module. Ensure they are there.
// Several are assumed and leveraged in later tests.
test('Validate existence of assumed internals', () => {
  // Checking the existing of the four main variables.
  expect(sfcalls.__get__('sfConnections')).toStrictEqual({});
  expect(sfcalls.__get__('proposedSchema')).toStrictEqual({});
  expect(sfcalls.__get__('mainWindow')).toBe(null);
  expect(sfcalls.__get__('preferences')).toBe(null);
  // Make sure the resolver list exists by checking one arbitrarily selected property.
  expect(sfcalls.__get__('typeDefaultResponses')).toHaveProperty('phone', 'fake: phone');
});

test('Check setWindow', () => {
  // The set window does no validation, so we cna set it to any object here.
  const myTestWindow = {
    testWindow: 1,
  };
  expect(sfcalls.__get__('mainWindow')).toBe(null);
  sfcalls.setWindow(myTestWindow);
  expect(sfcalls.__get__('mainWindow')).toHaveProperty('testWindow', 1);
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
  expect(sfcalls.__get__('preferences')).toBe(null);
  sfcalls.setPreferences(samplePrefs);
  expect(sfcalls.__get__('preferences')).toHaveProperty('theme');
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

  const definePicklistChoice = sfcalls.__get__('definePicklistChoice');
  const testResult = definePicklistChoice(sampleValues);
  expect(testResult).toMatch(/random_choice/);
  expect(testResult).toMatch(/Prospect/);
  expect(testResult).toMatch(/Test's/);
  expect(testResult).toMatch(/Duplicate/);
});
