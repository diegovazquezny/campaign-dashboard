module Api
  class MetaController < BaseController
    # The longest observed delay before an outcome lands (PLAN.md §3).
    OUTCOME_DELAY = 72.hours

    def show
      coverage = Metrics::DataCoverage.current

      render json: {
        data_coverage: coverage && { from: coverage.from, to: coverage.to },
        freshness: coverage && freshness(coverage.latest_update_at),
        locations: Location.order(:id).map { |l| l.slice(:id, :name, :timezone) },
        campaigns: Campaign.order(:id).map { |c| c.slice(:id, :name, :channel) }
      }
    end

    private

    def freshness(latest)
      {
        latest_update_at: latest.utc.iso8601,
        outcomes_may_be_incomplete_from: (latest.utc - OUTCOME_DELAY).to_date
      }
    end
  end
end
