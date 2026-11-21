namespace :metrics do
  desc "Build ~1M synthetic calls in a scratch <db>_scale_check database and EXPLAIN ANALYZE the metrics/daily queries " \
       "(env: CALLS, CAMPAIGNS, OFFICES, CALLERS, FROM, TO, DAYS, KEEP=1)"
  task scale_check: :environment do
    require Rails.root.join("lib/scale_check")
    ScaleCheck.run
  rescue ScaleCheck::Refused => e
    abort "scale_check refused: #{e.message}"
  end
end
