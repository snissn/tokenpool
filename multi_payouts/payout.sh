set -eux
while true; do
  python3 multi_payout.py 3 --pay
  python3 multi_payout.py 3 --pay
  sleep 6h;
  python3 multi_payout.py 100 --pay
  sleep 6h;
  python3 multi_payout.py 100 --pay
  sleep 6h;
  python3 multi_payout.py 100 --pay
  sleep 6h;
done
