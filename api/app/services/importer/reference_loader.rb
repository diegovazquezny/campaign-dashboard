require "csv"
require "set"

module Importer
  # Loads locations.csv and campaigns.csv: validates rows, upserts the valid
  # ones and reports exact counts. Does not own the transaction.
  class ReferenceLoader
    Counts = Struct.new(:rows, :inserted, :updated, :unchanged, :rejected, keyword_init: true)
    Result = Struct.new(:location_ids, :campaign_ids, :locations, :campaigns, :rejections, keyword_init: true)

    LOCATION_HEADERS = %w[location_id name timezone].freeze
    CAMPAIGN_HEADERS = %w[campaign_id name channel daily_budget_usd].freeze

    def initialize(data_dir)
      @data_dir = data_dir.to_s
    end

    def call
      rejections = []
      zones = Set.new(ActiveRecord::Base.connection.select_values("SELECT name FROM pg_timezone_names"))

      loc = process("locations.csv", LOCATION_HEADERS, "locations", %w[name timezone], rejections) do |row|
        raise Parsing::Invalid, "blank location_id" if blank?(row["location_id"])
        raise Parsing::Invalid, "blank name" if blank?(row["name"])
        raise Parsing::Invalid, "unknown timezone #{row['timezone'].inspect}" unless zones.include?(row["timezone"])

        [ row["location_id"], row["name"], row["timezone"] ]
      end

      camp = process("campaigns.csv", CAMPAIGN_HEADERS, "campaigns", %w[name channel daily_budget_cents], rejections) do |row|
        raise Parsing::Invalid, "blank campaign_id" if blank?(row["campaign_id"])
        raise Parsing::Invalid, "blank name" if blank?(row["name"])
        raise Parsing::Invalid, "unknown channel #{row['channel'].inspect}" unless Channel::ALL.include?(row["channel"])

        [ row["campaign_id"], row["name"], row["channel"], budget_cents(row["daily_budget_usd"]) ]
      end

      Result.new(location_ids: loc[:ids], campaign_ids: camp[:ids], locations: loc[:counts],
                 campaigns: camp[:counts], rejections: rejections)
    end

    private

    def blank?(value)
      value.nil? || value.strip.empty?
    end

    def budget_cents(str)
      Parsing.money_to_cents(str)
    rescue Parsing::Invalid => e
      raise Parsing::Invalid, "invalid daily_budget_usd: #{e.message}"
    end

    # The block turns a CSV row into [id, *attributes] or raises Parsing::Invalid.
    def process(file, headers, table, columns, rejections)
      candidates = []
      rows = 0
      read_csv(file, headers) do |row, line|
        rows += 1
        begin
          candidates << { line: line, values: yield(row) }
        rescue Parsing::Invalid => e
          rejections << Rejection.new(file: file, line: line, reason: e.message)
        end
      end

      valid = resolve_duplicates(file, candidates, rejections)
      inserted, updated = upsert(table, columns, valid)
      rejected = rejections.count { |r| r.file == file }
      counts = Counts.new(rows: rows, inserted: inserted, updated: updated,
                          unchanged: valid.size - inserted - updated, rejected: rejected)
      { ids: Set.new(valid.map(&:first)), counts: counts }
    end

    # Identical duplicate rows collapse; same id with different content rejects all of them.
    def resolve_duplicates(file, candidates, rejections)
      valid = []
      candidates.group_by { |c| c[:values].first }.each_value do |group|
        if group.map { |c| c[:values] }.uniq.size > 1
          group.each { |c| rejections << Rejection.new(file: file, line: c[:line], reason: "conflicting versions") }
        else
          valid << group.first[:values]
        end
      end
      valid
    end

    def read_csv(file, expected_headers)
      path = File.join(@data_dir, file)
      raise Error, "#{file} not found in #{@data_dir}" unless File.file?(path)

      csv = CSV.new(File.read(path), headers: true)
      csv.shift
      actual = csv.headers
      unless actual.is_a?(Array) && actual == expected_headers
        raise Error, "#{file}: expected header #{expected_headers.join(',')}, got #{Array(actual).join(',')}"
      end

      csv.rewind
      csv.each { |row| yield row, csv.lineno }
    rescue CSV::MalformedCSVError => e
      raise Error, "#{file}: #{e.message}"
    end

    # Returns [inserted, updated]; unchanged rows are not touched.
    def upsert(table, columns, valid)
      return [ 0, 0 ] if valid.empty?

      conn = ActiveRecord::Base.connection
      now = conn.quote(Time.current)
      values = valid.map { |v| "(#{v.map { |x| conn.quote(x) }.join(', ')}, #{now}, #{now})" }.join(", ")
      excluded = columns.map { |c| "excluded.#{c}" }.join(", ")
      current = columns.map { |c| "#{table}.#{c}" }.join(", ")
      sets = columns.map { |c| "#{c} = excluded.#{c}" }.join(", ")
      sql = <<~SQL.squish
        INSERT INTO #{table} (id, #{columns.join(', ')}, created_at, updated_at) VALUES #{values}
        ON CONFLICT (id) DO UPDATE SET #{sets}, updated_at = excluded.updated_at
        WHERE (#{current}) IS DISTINCT FROM (#{excluded})
        RETURNING (xmax = 0) AS inserted
      SQL
      flags = conn.select_values(sql).map { |f| f == true || f == "t" }
      [ flags.count(true), flags.count(false) ]
    end
  end
end
