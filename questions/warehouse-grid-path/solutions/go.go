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
 * Complete the 'shortestPath' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts STRING_ARRAY grid as parameter.
 */

func shortestPath(grid []string) int32 {
    rows, cols := len(grid), len(grid[0])
    width := cols + 2
    // Surround the floor with shelves so a step can never leave the grid.
    // blocked marks a cell the robot cannot step into: a shelf, or a cell it has already reached.
    blocked := make([]bool, (rows+2)*width)
    for i := range blocked {
        blocked[i] = true
    }
    start, end := -1, -1
    for r := 0; r < rows; r++ {
        for c := 0; c < cols; c++ {
            cell := (r+1)*width + c + 1
            ch := grid[r][c]
            blocked[cell] = ch == '#'
            if ch == 'S' {
                start = cell
            } else if ch == 'E' {
                end = cell
            }
        }
    }
    dist := make([]int32, len(blocked))
    queue := make([]int, 0, rows*cols)
    moves := [4]int{-width, width, -1, 1}
    queue = append(queue, start)
    blocked[start] = true
    for head := 0; head < len(queue); head++ { // breadth-first: cells leave the queue in order of distance
        cell := queue[head]
        for _, move := range moves {
            next := cell + move
            if !blocked[next] {
                dist[next] = dist[cell] + 1
                if next == end {
                    return dist[next]
                }
                blocked[next] = true
                queue = append(queue, next)
            }
        }
    }
    return -1
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    rowsTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    rows := int32(rowsTemp)

    colsTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    cols := int32(colsTemp)

    var grid []string

    for i := 0; i < int(rows); i++ {
        gridItem := strings.TrimSpace(readLine(reader))

        if len(gridItem) != int(cols) {
            panic("Bad input")
        }

        grid = append(grid, gridItem)
    }

    result := shortestPath(grid)

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
