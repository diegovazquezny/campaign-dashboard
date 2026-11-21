# Wipes the tables the importer writes. Refuses to run outside the test
# environment: a bare `docker compose run api bundle exec rspec` runs with
# RAILS_ENV=development against the dev database and would delete its data.
module CleanDatabase
  TABLES = [ Call, Campaign, Location ].freeze

  def self.wipe!
    unless Rails.env.test?
      raise "Refusing to delete data: specs must run with RAILS_ENV=test (got #{Rails.env.inspect})"
    end

    TABLES.each(&:delete_all)
  end
end

# `bin/rails db:prepare` seeds a freshly created database, and db/seeds.rb
# imports data/*.csv. Start every run from empty tables so specs never see
# that data, whichever way the test database was created.
RSpec.configure do |config|
  config.before(:suite) { CleanDatabase.wipe! }
end
