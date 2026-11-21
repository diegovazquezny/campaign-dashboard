class Location < ApplicationRecord
  has_many :calls, dependent: :restrict_with_exception

  validates :name, :timezone, presence: true
end
