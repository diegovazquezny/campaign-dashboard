module Importer
  # Stages validated call rows in a temp table, then upserts the latest version
  # of each call into calls. Must run inside the caller's transaction.
  class CallsWriter
    Written = Struct.new(:inserted, :updated, keyword_init: true)

    BATCH = 1000
    COLUMNS = %i[call_id started_at ended_at duration_seconds caller_number_hash tracking_number
                 campaign_id marketing_channel location_id answered outcome revenue_cents agent_id
                 source_updated_at].freeze

    def initialize(rows)
      @rows = rows
      @conn = ActiveRecord::Base.connection
    end

    def call
      create_staging
      stage
      upsert
    end

    # The upsert skips unchanged calls, so a timezone corrected in locations.csv
    # would leave their local_date stale. Fixes every call whose stored date no
    # longer matches its location's current timezone; returns the row count.
    def recompute_local_dates
      @conn.update(<<~SQL.squish)
        UPDATE calls SET local_date = (calls.started_at AT TIME ZONE locations.timezone)::date
        FROM locations
        WHERE calls.location_id = locations.id
          AND calls.local_date IS DISTINCT FROM (calls.started_at AT TIME ZONE locations.timezone)::date
      SQL
    end

    private

    # DROP IF EXISTS first so the table can be re-created within one outer
    # transaction (ON COMMIT DROP only fires at the outermost commit).
    def create_staging
      @conn.execute("DROP TABLE IF EXISTS calls_staging")
      @conn.execute(<<~SQL)
        CREATE TEMP TABLE calls_staging (
          line_number integer NOT NULL,
          call_id text NOT NULL, started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL,
          duration_seconds integer NOT NULL, caller_number_hash text NOT NULL, tracking_number text NOT NULL,
          campaign_id text, marketing_channel text NOT NULL, location_id text NOT NULL,
          answered boolean NOT NULL, outcome text, revenue_cents integer, agent_id text,
          source_updated_at timestamptz NOT NULL
        ) ON COMMIT DROP
      SQL
    end

    def stage
      @rows.each_slice(BATCH) do |slice|
        values = slice.map do |row|
          fields = COLUMNS.map { |c| @conn.quote(row.attributes.fetch(c)) }
          "(#{([ row.line ] + fields).join(', ')})"
        end
        @conn.execute("INSERT INTO calls_staging (line_number, #{COLUMNS.join(', ')}) VALUES #{values.join(', ')}")
      end
    end

    # The latest version per call wins (source_updated_at, then file line as a
    # deterministic tiebreak). The WHERE guard leaves unchanged calls untouched.
    def upsert
      return Written.new(inserted: 0, updated: 0) if @rows.empty?

      now = @conn.quote(Time.current)
      select_cols = COLUMNS.map { |c| "s.#{c}" }.join(", ")
      sets = (COLUMNS - [ :call_id ]).map { |c| "#{c} = excluded.#{c}" }.join(", ")
      flags = @conn.select_values(<<~SQL.squish).map { |f| f == true || f == "t" }
        INSERT INTO calls (#{COLUMNS.join(', ')}, local_date, created_at, updated_at)
        SELECT DISTINCT ON (s.call_id) #{select_cols},
               (s.started_at AT TIME ZONE l.timezone)::date, #{now}, #{now}
        FROM calls_staging s JOIN locations l ON l.id = s.location_id
        ORDER BY s.call_id, s.source_updated_at DESC, s.line_number DESC
        ON CONFLICT (call_id) DO UPDATE SET #{sets}, local_date = excluded.local_date, updated_at = excluded.updated_at
        WHERE excluded.source_updated_at > calls.source_updated_at
        RETURNING (xmax = 0) AS inserted
      SQL
      Written.new(inserted: flags.count(true), updated: flags.count(false))
    end
  end
end
