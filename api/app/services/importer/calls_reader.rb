require "csv"
require "digest"

module Importer
  # Reads calls.csv, validates every row, and collapses/rejects duplicate
  # versions. Rows are collected before being returned (parsing is streamed,
  # the valid set is held in memory).
  class CallsReader
    FILE = "calls.csv".freeze
    HEADERS = %w[call_id started_at ended_at duration_seconds caller_number_hash
                 tracking_number campaign_id marketing_channel location_id answered
                 outcome revenue_usd agent_id updated_at].freeze

    Row = Data.define(:line, :attributes)
    Result = Data.define(:rows, :rejections, :rows_read, :duplicates_collapsed)

    def initialize(path, location_ids:, campaign_ids:)
      @path = path
      @validator = CallRowValidator.new(location_ids: location_ids, campaign_ids: campaign_ids)
    end

    def call
      raise Error, "#{FILE}: file not found (#{@path})" unless File.file?(@path)

      @rejections = []
      @seen = {} # [call_id, updated_at] => { digest:, row:, conflicted: }
      @rows_read = 0
      @collapsed = 0
      each_row { |row, line| process(row, line) }
      finish
    end

    private

    def each_row
      CSV.open(@path, "r") do |csv|
        check_header(csv.shift.to_a)
        csv.each do |fields|
          yield HEADERS.zip(fields).to_h, csv.lineno
        end
      end
    rescue CSV::MalformedCSVError => e
      raise Error, "#{FILE}: #{e.message}"
    end

    def check_header(header)
      return if header == HEADERS

      raise Error, "#{FILE}: bad header (missing: #{(HEADERS - header).join(",")}; extra: #{(header - HEADERS).join(",")})"
    end

    def process(row, line)
      @rows_read += 1
      outcome = @validator.call(row, line)
      return @rejections << outcome if outcome.is_a?(Rejection)

      key = [ outcome[:call_id], outcome[:source_updated_at] ]
      digest = Digest::SHA256.hexdigest(outcome.to_a.inspect)
      entry = @seen[key]
      if entry.nil?
        @seen[key] = { digest: digest, row: Row.new(line: line, attributes: outcome), conflicted: false }
      elsif entry[:conflicted]
        @rejections << conflict(line)
      elsif entry[:digest] == digest
        @collapsed += 1
      else
        entry[:conflicted] = true
        @rejections << conflict(line)
      end
    end

    def conflict(line)
      Rejection.new(file: FILE, line: line, reason: "conflicting versions")
    end

    def finish
      rows = []
      @seen.each_value do |entry|
        if entry[:conflicted]
          @rejections << conflict(entry[:row].line)
        else
          rows << entry[:row]
        end
      end
      Result.new(rows: rows.sort_by(&:line), rejections: @rejections.sort_by(&:line),
                 rows_read: @rows_read, duplicates_collapsed: @collapsed)
    end
  end
end
