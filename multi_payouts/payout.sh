set -eux
while true; do
  python3 multi_payout.py 3 --pay
  date
  sleep 4h;
done
