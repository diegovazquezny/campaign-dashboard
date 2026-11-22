module Metrics
  # The `new_callers` rule (PLAN.md section 7, D2), as one SQL fragment shared by
  # every consumer: a call is a caller's first when no earlier call, ordered by
  # (started_at, call_id), exists from the same caller in the unfiltered `calls`
  # table. It ignores range, office and campaign, and probes the
  # (caller_number_hash, started_at, call_id) index.
  module EarlierCallProbe
    module_function

    # SQL boolean expression: true when the call aliased `call_alias` has no
    # earlier call from the same caller.
    def no_earlier_call_sql(call_alias = "c")
      <<~SQL.squish
        NOT EXISTS (
          SELECT 1 FROM calls prior
          WHERE prior.caller_number_hash = #{call_alias}.caller_number_hash
            AND (prior.started_at, prior.call_id) < (#{call_alias}.started_at, #{call_alias}.call_id)
        )
      SQL
    end
  end
end
