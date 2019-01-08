set -eux

while true; do 
  python delete_submitted_shares_hash.py  
  python delete_submitted_shares_list.py
  python delete_stale_data.py
  sleep 6h
done
