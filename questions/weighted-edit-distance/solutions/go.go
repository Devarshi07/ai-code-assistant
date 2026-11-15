package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

/*
 * Complete the 'minimumEditCost' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. STRING a
 *  2. STRING b
 *  3. INTEGER insertCost
 *  4. INTEGER deleteCost
 *  5. INTEGER replaceCost
 */

func minimumEditCost(a string, b string, insertCost int32, deleteCost int32, replaceCost int32) int64 {
    // Keep one DP row over the shorter string. Turning a into b costs the same
    // as turning b into a with the insert and delete costs swapped.
    if len(b) > len(a) {
        a, b = b, a
        insertCost, deleteCost = deleteCost, insertCost
    }
    ins, del, rep := int64(insertCost), int64(deleteCost), int64(replaceCost)
    m := len(b)
    prev := make([]int64, m+1)
    cur := make([]int64, m+1)
    for j := 0; j <= m; j++ {
        prev[j] = int64(j) * ins
    }
    for i := 1; i <= len(a); i++ {
        cur[0] = int64(i) * del
        for j := 1; j <= m; j++ {
            best := prev[j-1]
            if a[i-1] != b[j-1] {
                best += rep
            }
            if prev[j]+del < best {
                best = prev[j] + del
            }
            if cur[j-1]+ins < best {
                best = cur[j-1] + ins
            }
            cur[j] = best
        }
        prev, cur = cur, prev
    }
    return prev[m]
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    a := strings.TrimSpace(readLine(reader))

    b := strings.TrimSpace(readLine(reader))

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    insertCostTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    insertCost := int32(insertCostTemp)

    deleteCostTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    deleteCost := int32(deleteCostTemp)

    replaceCostTemp, err := strconv.ParseInt(firstMultipleInput[2], 10, 64)
    checkError(err)
    replaceCost := int32(replaceCostTemp)

    result := minimumEditCost(a, b, insertCost, deleteCost, replaceCost)

    fmt.Printf("%d\n", result)
}

func readLine(reader *bufio.Reader) string {
    str, _, err := reader.ReadLine()
    if err == io.EOF {
        return ""
    }

    return strings.TrimRight(string(str), "\r\n")
}

func checkError(err error) {
    if err != nil {
        panic(err)
    }
}
