set -eux
while true; do
  python3 multi_payout.py 5 --pay
  date
  sleep 1h;
  python3 multi_payout.py  5 --pay
  date
  sleep 1h;
  python3 multi_payout.py  5 --pay
  date
  sleep 1h;
  python3 multi_payout.py  5 --pay
  date
  sleep 1h;
done
