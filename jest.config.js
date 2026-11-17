const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const getConfig = createJestConfig({
  testEnvironment: 'jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
})

module.exports = async () => {
  const config = await getConfig()
  // FullCalendar 7 and its date utilities ship as ESM.
  config.transformIgnorePatterns = [
    '/node_modules/(?!(@fullcalendar|@full-ui|temporal-polyfill|temporal-spec|temporal-utils)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ]
  return config
}
