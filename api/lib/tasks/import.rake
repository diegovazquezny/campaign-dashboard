namespace :import do
  desc "Re-import locations.csv, campaigns.csv and calls.csv from DATA_DIR (default: ../data)"
  task all: :environment do
    puts Importer.run.summary
  rescue Importer::Error => e
    abort "import failed: #{e.message}"
  end
end
