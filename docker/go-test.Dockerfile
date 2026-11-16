# Runtime for guided problems in Go: Go 1.24 with the packages these problems
# use already compiled into the build cache (by building and testing a small
# warm-up module), so the first test run in a workspace is quick.
# Built once by the app (debug-gym/go-test:1); workspace containers run it
# offline with a writable layer, so the cache can grow during a session.
FROM golang:1.24-alpine
ENV GOCACHE=/opt/gocache GOPATH=/opt/gopath GOTOOLCHAIN=local CGO_ENABLED=0 GOFLAGS=-buildvcs=false
RUN mkdir -p /tmp/warm/tests && cd /tmp/warm \
 && printf 'module warm\n\ngo 1.24\n' > go.mod \
 && printf 'package main\n\nimport (\n\t"bufio"\n\t"bytes"\n\t"cmp"\n\t"container/heap"\n\t"container/list"\n\t"encoding/json"\n\t"errors"\n\t"fmt"\n\t"maps"\n\t"math"\n\t"math/rand"\n\t"math/rand/v2"\n\t"os"\n\t"regexp"\n\t"slices"\n\t"sort"\n\t"strconv"\n\t"strings"\n\t"sync"\n\t"time"\n\t"unicode"\n\t"unicode/utf8"\n)\n\nvar _ = []any{bufio.NewReader, bytes.NewBuffer, cmp.Compare[int], heap.Init, list.New, json.Marshal, errors.New, fmt.Sprint, maps.Keys[map[int]int], math.Abs, rand.Intn, rand.N[int], os.Exit, regexp.MustCompile, slices.Sort[[]int], sort.Ints, strconv.Itoa, strings.Split, sync.NewCond, time.Now, unicode.IsLetter, utf8.RuneLen}\n\nfunc main() { fmt.Println("ok") }\n' > main.go \
 && printf 'package tests\n\nimport (\n\t"reflect"\n\t"strings"\n\t"testing"\n\t"time"\n)\n\nfunc TestWarm(t *testing.T) {\n\tif !reflect.DeepEqual(strings.Fields("a b"), []string{"a", "b"}) || time.Since(time.Now()) > time.Hour {\n\t\tt.Fatal("x")\n\t}\n}\n' > tests/warm_test.go \
 && go run . && go test -json -vet=off -count=1 ./tests/... > /dev/null \
 && cd / && rm -rf /tmp/warm && chmod -R a+rwX /opt/gocache /opt/gopath 2>/dev/null; true
