class Location < ApplicationRecord
  validates :name, :timezone, presence: true
end
