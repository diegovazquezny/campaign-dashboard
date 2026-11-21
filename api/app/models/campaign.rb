class Campaign < ApplicationRecord
  # scopes: false, because the `display` value would otherwise define
  # Campaign.display and shadow Object#display.
  enum :channel, Channel::ALL.index_with(&:itself), scopes: false, validate: true

  has_many :calls, dependent: :restrict_with_exception

  validates :name, presence: true
  validates :daily_budget_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
