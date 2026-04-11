'use strict';
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  reporters: ['default', '<rootDir>/reporter.js'],
  snapshotFormat: { escapeString: false, printBasicPrototype: false },
};
