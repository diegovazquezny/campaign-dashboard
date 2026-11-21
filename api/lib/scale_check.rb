# Backs `bin/rails metrics:scale_check`: builds a large synthetic dataset in a
# scratch database and prints EXPLAIN (ANALYZE, BUFFERS) for the metrics and
# daily queries. It never touches the development or test database: it creates
# `<configured database>_scale_check`, points ActiveRecord at it, and drops it
# afterwards (KEEP=1 leaves it for inspection).
class ScaleCheck
  class Refused < StandardError; end

  SUFFIX = "_scale_check".freeze
  CHANNELS = %w[paid_search social display organic direct referral].freeze

  # The only database name this task may create, connect to or drop.
  def self.scratch_name(base, rails_env: Rails.env)
    raise Refused, "refusing to run in production" if rails_env.to_s == "production"
    raise Refused, "no database configured" if base.to_s.empty?
    raise Refused, "#{base} is already a scratch database" if base.end_with?(SUFFIX)

    "#{base}#{SUFFIX}"
  end

  def self.assert_scratch!(name)
    raise Refused, "#{name.inspect} is not a #{SUFFIX} database" unless name.to_s.end_with?(SUFFIX)
  end

  def self.run(out: $stdout, env: ENV)
    new(out:, env:).run
  end

  def initialize(out: $stdout, env: ENV)
    @out = out
    @calls = Integer(env.fetch("CALLS", 1_000_000))
    @campaigns = Integer(env.fetch("CAMPAIGNS", 500))
    @offices = Integer(env.fetch("OFFICES", 50))
    @callers = Integer(env.fetch("CALLERS") { [ @calls / 3, 1 ].max })
    @from = Date.iso8601(env.fetch("FROM", "2026-09-01"))
    @to = Date.iso8601(env.fetch("TO", "2026-09-30"))
    @days = Integer(env.fetch("DAYS", 92)) # data spans the 92 days ending 2026-09-30
    @keep = env["KEEP"] == "1"
  end

  def run
    original = ActiveRecord::Base.connection_db_config.configuration_hash
    scratch = self.class.scratch_name(original[:database])
    admin = original.merge(database: "postgres")
    scratch_config = original.merge(database: scratch)

    say "scratch database: #{scratch} (#{@calls} calls, #{@campaigns} campaigns, #{@offices} offices)"
    begin
      recreate(admin, scratch)
      ActiveRecord::Base.establish_connection(scratch_config)
      conn = ActiveRecord::Base.connection
      self.class.assert_scratch!(conn.current_database)
      load_schema
      populate(conn)
      report(conn)
    ensure
      ActiveRecord::Base.establish_connection(original)
      drop(admin, scratch, original) unless @keep
    end
  end

  private

  def say(text = "")
    @out.puts(text)
  end

  def admin_exec(admin, sql)
    ActiveRecord::Base.establish_connection(admin)
    ActiveRecord::Base.connection.execute(sql)
  ensure
    ActiveRecord::Base.connection_pool.disconnect!
  end

  def recreate(admin, scratch)
    self.class.assert_scratch!(scratch)
    admin_exec(admin, "DROP DATABASE IF EXISTS #{PG::Connection.quote_ident(scratch)} WITH (FORCE)")
    admin_exec(admin, "CREATE DATABASE #{PG::Connection.quote_ident(scratch)}")
  end

  def drop(admin, scratch, original)
    self.class.assert_scratch!(scratch)
    admin_exec(admin, "DROP DATABASE IF EXISTS #{PG::Connection.quote_ident(scratch)} WITH (FORCE)")
    ActiveRecord::Base.establish_connection(original)
    say "dropped #{scratch}"
  end

  def load_schema
    verbose = ActiveRecord::Schema.verbose
    ActiveRecord::Schema.verbose = false
    load Rails.root.join("db/schema.rb")
    ActiveRecord::Schema.verbose = verbose
  end

  def populate(conn)
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    conn.execute("SET TimeZone = 'UTC'")
    conn.execute("SELECT setseed(0.42)")
    channels = "ARRAY[#{CHANNELS.map { |c| conn.quote(c) }.join(',')}]"

    conn.execute(<<~SQL)
      INSERT INTO locations (id, name, timezone, created_at, updated_at)
      SELECT 'loc_' || lpad(i::text, 3, '0'), 'Office ' || i, 'UTC', now(), now()
      FROM generate_series(1, #{@offices}) i
    SQL
    conn.execute(<<~SQL)
      INSERT INTO campaigns (id, name, channel, daily_budget_cents, created_at, updated_at)
      SELECT 'cmp_' || lpad(i::text, 3, '0'), 'Campaign ' || i, (#{channels})[i % 6 + 1],
        CASE WHEN i % 10 = 0 THEN 0 ELSE 5000 + (i * 137) % 45000 END, now(), now()
      FROM generate_series(1, #{@campaigns}) i
    SQL
    conn.execute(<<~SQL)
      INSERT INTO calls (call_id, started_at, ended_at, duration_seconds, caller_number_hash, tracking_number,
        campaign_id, marketing_channel, location_id, answered, outcome, revenue_cents, agent_id,
        source_updated_at, local_date, created_at, updated_at)
      SELECT 'call_' || i, started, started + make_interval(secs => dur), dur, 'caller_' || caller, '+15550000000',
        CASE WHEN camp IS NULL THEN NULL ELSE 'cmp_' || lpad(camp::text, 3, '0') END,
        CASE WHEN camp IS NULL THEN 'direct' ELSE (#{channels})[camp % 6 + 1] END,
        'loc_' || lpad(loc::text, 3, '0'), answered, outcome,
        CASE WHEN outcome = 'booked' THEN 5000 + floor(r5 * 50000)::int END,
        CASE WHEN answered THEN 'agent_' || (1 + i % 200) END,
        started + interval '1 day', (started AT TIME ZONE 'UTC')::date, now(), now()
      FROM (
        SELECT i, started, dur, caller, camp, loc, answered, r5,
          CASE WHEN answered THEN (CASE WHEN r3 < 0.3 THEN 'booked' WHEN r3 < 0.5 THEN 'qualified_lead'
                                        WHEN r3 < 0.7 THEN 'not_qualified' END)
               ELSE (CASE WHEN r4 < 0.5 THEN 'missed' ELSE 'voicemail' END) END AS outcome
        FROM (
          SELECT i,
            (date '#{@to}' - #{@days - 1})::timestamptz + make_interval(secs => floor(random() * #{@days * 86_400})) AS started,
            floor(random() * 600)::int AS dur,
            1 + floor(random() * #{@callers})::int AS caller,
            CASE WHEN random() < 0.05 THEN NULL ELSE 1 + floor(random() * #{@campaigns})::int END AS camp,
            1 + floor(random() * #{@offices})::int AS loc,
            random() > 0.2 AS answered, random() AS r3, random() AS r4, random() AS r5
          FROM generate_series(1, #{@calls}) i
        ) raw
      ) shaped
    SQL
    conn.execute("ANALYZE")
    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started
    count = conn.select_value("SELECT count(*) FROM calls")
    say format("loaded %d calls and ANALYZEd in %.1fs", count, elapsed)
    say "indexes: #{conn.indexes(:calls).map(&:name).join(', ')}"
  end

  def report(conn)
    coverage = Metrics::DataCoverage.current
    say "coverage: #{coverage&.from} .. #{coverage&.to}; query range #{@from} .. #{@to}"
    campaign = Campaign.order(:id).first
    location = Location.order(:id).first.id
    explain(conn, "CampaignMetrics, no location filter", Metrics::CampaignMetrics.sql(from: @from, to: @to))
    explain(conn, "CampaignMetrics, location_id=#{location}", Metrics::CampaignMetrics.sql(from: @from, to: @to, location_id: location))
    explain(conn, "CampaignDaily #{campaign.id}, no location filter", Metrics::CampaignDaily.sql(campaign:, from: @from, to: @to))
    explain(conn, "CampaignDaily #{campaign.id}, location_id=#{location}", Metrics::CampaignDaily.sql(campaign:, from: @from, to: @to, location_id: location))
  end

  def explain(conn, label, sql)
    say
    say "=== #{label} ==="
    plan = conn.select_values("EXPLAIN (ANALYZE, BUFFERS) #{sql}")
    plan.each { |line| say line }
    execution = plan.grep(/Execution Time/).first
    say "--> #{label}: #{execution.to_s.strip}"
  end
end
