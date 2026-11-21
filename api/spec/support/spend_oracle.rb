# Rational reference implementation of the spend rules, used only by specs to
# check the SQL in Metrics::SpendSql. Rational#round is half away from zero,
# like Postgres numeric round.
module SpendOracle
  module_function

  def covered_days(from:, to:, cov_from:, cov_to:)
    return 0 if cov_from.nil? || cov_to.nil?

    [ 0, ([ to, cov_to ].min - [ from, cov_from ].max).to_i + 1 ].max
  end

  # office_calls/campaign_calls are ignored when filtered is false.
  def total_cents(budget:, covered_days:, filtered:, office_calls: nil, campaign_calls: nil)
    return nil if budget.to_i.zero?
    return budget * covered_days unless filtered
    return nil if campaign_calls.zero?

    exact(budget, office_calls, campaign_calls, covered_days).round
  end

  def daily_cents(budget:, covered_day:, covered_through:, filtered:, office_calls: nil, campaign_calls: nil)
    return nil if budget.to_i.zero?
    return (covered_day ? budget : 0) unless filtered
    return nil if campaign_calls.zero?
    return 0 unless covered_day

    exact(budget, office_calls, campaign_calls, covered_through).round -
      exact(budget, office_calls, campaign_calls, covered_through - 1).round
  end

  def exact(budget, office_calls, campaign_calls, days)
    Rational(office_calls * budget * days, campaign_calls)
  end
end
