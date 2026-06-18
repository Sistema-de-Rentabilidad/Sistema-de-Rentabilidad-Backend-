module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setupTests.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/migrations/**',
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: 1
};
