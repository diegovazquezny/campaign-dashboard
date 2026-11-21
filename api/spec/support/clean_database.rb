# `bin/rails db:prepare` seeds a freshly created database, and db/seeds.rb
# imports data/*.csv. Start every run from empty tables so specs never see
# that data, whichever way the test database was created.
RSpec.configure do |config|
  config.before(:suite) do
    [ Call, Campaign, Location ].each(&:delete_all)
  end
end
