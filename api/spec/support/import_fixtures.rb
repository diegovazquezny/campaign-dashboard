require "csv"
require "fileutils"
require "tmpdir"

# Helpers for pointing the importer at the CSV fixtures in
# spec/fixtures/files/import/. The base set (locations.csv, campaigns.csv,
# calls.csv) is always copied first; each scenario directory then overwrites
# only the files it contains, so a scenario never has to repeat the base files.
module ImportFixtures
  IMPORT_FIXTURE_ROOT = Rails.root.join("spec/fixtures/files/import")

  # Yields a temporary data directory holding the base set overlaid with the
  # given scenarios (applied in order), and removes it afterwards:
  #
  #   with_import_dir("rejects") { |dir| Importer.run(data_dir: dir) }
  def with_import_dir(*scenarios)
    Dir.mktmpdir("import-fixtures") do |dir|
      [ nil, *scenarios ].each do |scenario|
        source = scenario ? IMPORT_FIXTURE_ROOT.join(scenario.to_s) : IMPORT_FIXTURE_ROOT
        raise ArgumentError, "unknown import fixture scenario: #{scenario}" unless source.directory?

        source.children.select { |f| f.file? && f.extname == ".csv" }.each do |file|
          FileUtils.cp(file, File.join(dir, file.basename))
        end
      end
      yield dir
    end
  end

  # Parsed rows (array of hashes) of a single fixture file, for assertions.
  def import_fixture_rows(file, scenario = nil)
    path = scenario ? IMPORT_FIXTURE_ROOT.join(scenario.to_s, file) : IMPORT_FIXTURE_ROOT.join(file)
    CSV.read(path, headers: true).map(&:to_h)
  end
end
