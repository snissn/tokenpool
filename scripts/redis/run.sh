set -eux

while true; do 
  python delete_submitted_shares_hash.py  
  python delete_submitted_shares_list.py
  sleep 1h
done
