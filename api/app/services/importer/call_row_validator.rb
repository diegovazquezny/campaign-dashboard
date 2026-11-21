module Importer
  # Validates one calls.csv row (a Hash keyed by header). #call returns a
  # normalized attribute Hash, or an Importer::Rejection naming the failed rule.
  class CallRowValidator
    FILE = "calls.csv".freeze
    REQUIRED = %w[call_id caller_number_hash tracking_number started_at ended_at
                  location_id marketing_channel updated_at].freeze
    UNANSWERED_OUTCOMES = %w[missed voicemail].freeze
    ANSWERED_OUTCOMES = %w[booked qualified_lead not_qualified].freeze

    def initialize(location_ids:, campaign_ids:)
      @location_ids = location_ids
      @campaign_ids = campaign_ids
    end

    def call(row, line)
      attrs = nil
      reason = begin
        blank = REQUIRED.find { |f| value(row, f).nil? }
        if blank
          "#{blank} is blank"
        else
          attrs = parse(row)
          check_enums(attrs) || check_rules(attrs) || check_references(attrs)
        end
      rescue Parsing::Invalid => e
        e.message
      end
      reason ? Rejection.new(file: FILE, line: line, reason: reason) : attrs
    end

    private

    def value(row, name)
      v = row[name].to_s
      v.empty? ? nil : v
    end

    def parse_as(row, field, kind)
      Parsing.public_send(kind, value(row, field))
    rescue Parsing::Invalid => e
      raise Parsing::Invalid, "#{field}: #{e.message}"
    end

    def parse(row)
      {
        call_id: value(row, "call_id"),
        started_at: parse_as(row, "started_at", :timestamp),
        ended_at: parse_as(row, "ended_at", :timestamp),
        source_updated_at: parse_as(row, "updated_at", :timestamp),
        duration_seconds: parse_as(row, "duration_seconds", :integer),
        caller_number_hash: value(row, "caller_number_hash"),
        tracking_number: value(row, "tracking_number"),
        campaign_id: value(row, "campaign_id"),
        marketing_channel: value(row, "marketing_channel"),
        location_id: value(row, "location_id"),
        answered: parse_as(row, "answered", :boolean),
        outcome: value(row, "outcome"),
        revenue_cents: value(row, "revenue_usd") && parse_as(row, "revenue_usd", :money_to_cents),
        agent_id: value(row, "agent_id")
      }
    end

    def check_enums(attrs)
      unless Channel::ALL.include?(attrs[:marketing_channel])
        return "marketing_channel: unknown value #{attrs[:marketing_channel].inspect}"
      end

      outcome = attrs[:outcome]
      "outcome: unknown value #{outcome.inspect}" if outcome && !Outcome::ALL.include?(outcome)
    end

    def check_rules(attrs)
      check_answered(attrs) || check_revenue(attrs) || check_times(attrs)
    end

    def check_answered(attrs)
      outcome = attrs[:outcome]
      if attrs[:answered]
        return "answered call has no agent_id" if attrs[:agent_id].nil?

        "answered call has outcome #{outcome}" if outcome && !ANSWERED_OUTCOMES.include?(outcome)
      else
        return "unanswered call has an agent_id" if attrs[:agent_id]

        "unanswered call must have outcome missed or voicemail" unless UNANSWERED_OUTCOMES.include?(outcome)
      end
    end

    def check_revenue(attrs)
      return "revenue present without outcome booked" if attrs[:revenue_cents] && attrs[:outcome] != "booked"

      "booked call has no revenue" if attrs[:outcome] == "booked" && attrs[:revenue_cents].nil?
    end

    def check_times(attrs)
      return "ended_at is before started_at" if attrs[:ended_at] < attrs[:started_at]

      expected = (attrs[:ended_at] - attrs[:started_at]).to_i
      return if attrs[:duration_seconds] == expected

      "duration_seconds #{attrs[:duration_seconds]} does not match ended_at - started_at (#{expected})"
    end

    def check_references(attrs)
      unless @location_ids.include?(attrs[:location_id])
        return "unknown location_id #{attrs[:location_id].inspect}"
      end

      campaign_id = attrs[:campaign_id]
      "unknown campaign_id #{campaign_id.inspect}" if campaign_id && !@campaign_ids.include?(campaign_id)
    end
  end
end
