module Metrics
  # SQL fragments for the spend rules (PLAN.md section 7). Every fragment is a
  # scalar expression over columns of a caller-supplied relation, so the same
  # text can run in the campaign table query and the daily query. All results
  # are cast ::bigint, and multiplication happens before division in numeric so
  # nothing is truncated ahead of round() (round is half away from zero).
  module SpendSql
    module_function

    # Days in [from, to] that fall inside the data coverage [cov_from, cov_to];
    # 0 when disjoint or when there is no coverage (cov_from/cov_to nil).
    # Each argument is a Date or a SQL date expression (String; trusted SQL,
    # never pass request input). A coverage expression that evaluates to NULL
    # (e.g. min/max over an empty table) also gives 0, because LEAST and
    # GREATEST would otherwise ignore the NULL and return the full range.
    def covered_days(from:, to:, cov_from:, cov_to:)
      return "0::bigint" if cov_from.nil? || cov_to.nil?

      <<~SQL.squish
        (CASE WHEN #{date(cov_from)} IS NULL OR #{date(cov_to)} IS NULL THEN 0
        ELSE GREATEST(0, LEAST(#{date(to)}, #{date(cov_to)}) - GREATEST(#{date(from)}, #{date(cov_from)}) + 1)
        END)::bigint
      SQL
    end

    # Columns: daily_budget_cents, covered_days, office_calls, campaign_calls.
    def total_cents(filtered:)
      spend = if filtered
        <<~SQL.squish
          CASE
            WHEN campaign_calls = 0 THEN NULL
            WHEN office_calls = 0 THEN 0
            ELSE round(office_calls::numeric * daily_budget_cents * covered_days / campaign_calls)
          END
        SQL
      else
        "daily_budget_cents::numeric * covered_days"
      end
      paid_only(spend)
    end

    # Columns: daily_budget_cents, office_calls, campaign_calls, covered_day
    # (boolean: the day is inside coverage) and covered_through (covered days
    # from `from` through this day). A covered day gets
    # round(f(covered_through)) - round(f(covered_through - 1)) with
    # f(k) = office_calls * budget * k / campaign_calls, so the daily values
    # telescope to total_cents.
    def daily_cents(filtered:)
      spend = if filtered
        <<~SQL.squish
          CASE
            WHEN campaign_calls = 0 THEN NULL
            WHEN covered_day IS NOT TRUE THEN 0
            ELSE #{cumulative('covered_through')} - #{cumulative('(covered_through - 1)')}
          END
        SQL
      else
        "CASE WHEN covered_day IS TRUE THEN daily_budget_cents ELSE 0 END"
      end
      paid_only(spend)
    end

    def cumulative(days)
      "round(office_calls::numeric * daily_budget_cents * #{days} / campaign_calls)"
    end

    # $0-budget and "No campaign" (NULL budget) have no spend.
    def paid_only(spend)
      "(CASE WHEN COALESCE(daily_budget_cents, 0) = 0 THEN NULL ELSE #{spend} END)::bigint"
    end

    # A String is trusted SQL, parenthesised so it cannot change precedence.
    def date(value)
      return "(#{value})" if value.is_a?(String)

      "#{ActiveRecord::Base.connection.quote(value.to_date.iso8601)}::date"
    end
    private_class_method :cumulative, :paid_only, :date
  end
end
