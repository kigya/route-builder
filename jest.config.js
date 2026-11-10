module.exports = {
  preset: 'jest-expo',
  transform: { '^.+\\.mjs$': 'babel-jest' },
  transformIgnorePatterns: require('jest-expo/jest-preset').transformIgnorePatterns.map((pattern) =>
    pattern.replace(
      '|standard-navigation',
      '|standard-navigation|@rn-primitives|lucide-react-native|nativewind'
    )
  ),
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css)$': '<rootDir>/tests/helpers/styleMock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
};
