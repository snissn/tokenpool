set -eux
while true; do
  (
   cd ../sedo_multi_payouts/
   python3 multi_payout.py 6 --pay
   sleep 1m
  )
  python3 multi_payout.py 3 --pay
  date
  sleep 24h;
done
