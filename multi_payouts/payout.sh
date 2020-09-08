set -eux
while true; do
  python3 multi_payout.py 3 --pay
  sleep 48h;
  date
  (
   sleep 1m
   cd ../sedo_multi_payouts/
   python3 multi_payout.py 6 --pay
  )
done
