package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "sort"
    "strconv"
    "strings"
)

/*
 * Complete the 'longestClimb' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY alt as parameter.
 */

func longestClimb(alt []int32) []int32 {
    const mod = 1000000007
    // A Fenwick tree over value ranks: node i stores the longest climb ending at a
    // value whose rank lies in its range, and how many such climbs there are.
    sorted := make([]int, len(alt))
    for i, v := range alt {
        sorted[i] = int(v)
    }
    sort.Ints(sorted)
    distinct := sorted[:0]
    for i, v := range sorted {
        if i == 0 || v != sorted[i-1] {
            distinct = append(distinct, v)
        }
    }
    size := len(distinct)
    treeLen := make([]int32, size+1)
    treeCnt := make([]int64, size+1)
    for _, v := range alt {
        r := sort.SearchInts(distinct, int(v)) + 1
        var best int32
        var ways int64 = 1
        for i := r - 1; i > 0; i &= i - 1 {
            if treeLen[i] > best {
                best, ways = treeLen[i], treeCnt[i]
            } else if treeLen[i] == best {
                ways += treeCnt[i]
            }
        }
        best++
        ways %= mod
        for i := r; i <= size; i += i & -i {
            if treeLen[i] < best {
                treeLen[i], treeCnt[i] = best, ways
            } else if treeLen[i] == best {
                treeCnt[i] = (treeCnt[i] + ways) % mod
            }
        }
    }
    var best int32
    var ways int64
    for i := size; i > 0; i &= i - 1 {
        if treeLen[i] > best {
            best, ways = treeLen[i], treeCnt[i]
        } else if treeLen[i] == best {
            ways += treeCnt[i]
        }
    }
    return []int32{best, int32(ways % mod)}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    nTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    n := int32(nTemp)

    altTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var alt []int32

    for i := 0; i < int(n); i++ {
        altItemTemp, err := strconv.ParseInt(altTemp[i], 10, 64)
        checkError(err)
        altItem := int32(altItemTemp)
        alt = append(alt, altItem)
    }

    result := longestClimb(alt)

    for i, resultItem := range result {
        fmt.Fprintf(writer, "%d", resultItem)

        if i != len(result) - 1 {
            fmt.Fprintf(writer, " ")
        }
    }

    fmt.Fprintf(writer, "\n")

    writer.Flush()
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
