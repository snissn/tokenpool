set -eux
while true; do
  python3 multi_payout.py 5 --pay
  sleep 1h;
  python3 multi_payout.py  50 --pay
  sleep 1h;
  python3 multi_payout.py  30 --pay
  sleep 1h;
  python3 multi_payout.py  20 --pay
  sleep 1h;
done
