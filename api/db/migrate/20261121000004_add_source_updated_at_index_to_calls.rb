class AddSourceUpdatedAtIndexToCalls < ActiveRecord::Migration[8.1]
  # Lets MAX(source_updated_at) in Metrics::DataCoverage use an index.
  def change
    add_index :calls, :source_updated_at
  end
end
