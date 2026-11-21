class CreateLocations < ActiveRecord::Migration[8.1]
  def change
    create_table :locations, id: false do |t|
      t.text :id, null: false, primary_key: true
      t.text :name, null: false
      t.text :timezone, null: false

      t.timestamps
    end
  end
end
