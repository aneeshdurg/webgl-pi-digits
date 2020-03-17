import json
import sys

terms = 100;

def compute(n, k, j):
    c = 8 * k + j;
    if n > k:
        return ((16 ** (n - k)) % c) / c
    return 16 ** (n - k) / c

def compute_sequence(n, count):
    res = []
    for i in range(count):
        res.append(compute(n, i, 1))
        res.append(compute(n, i, 4))
        res.append(compute(n, i, 5))
        res.append(compute(n, i, 6))
    return res

if __name__ == "__main__":
    n = int(sys.argv[1])
    count = int(sys.argv[2])
    res = compute_sequence(n, count)
    print(res)
    with open(sys.argv[3], 'w') as f:
        json.dump(res, f)
