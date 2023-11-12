## Mocha

Mocha test framework - TypeScript transferred.

The orginal Mocha project @see mochajs/mocha.

### Notes 

* Use the project

  ```bash
  # install (Typescript and Prettier in dependencies)
  > npm install
  
  # compile
  > npx tsc --target es2018 --module nodenext --outDir './lib'
  # and copy two files
  > cp src/mocharc.json lib/ && cp src/browser/template.html lib/browser/

  # format
  > npx prettier -w ./lib
  
  # try all testcases
  > npx nps test
  ```

* Diff with orginal project

  ```bash
  # download orginal archive .tar.gz from mochajs/mocha
  > wget https://github.com/mochajs/mocha/archive/master.tar.gz
  
  # extact orginal lib to ./lib2 from the archive (or, unzip and mv ...)
  > tar -xzvf ./master.tar.gz --wildcards mocha*/lib/* --strip-components=2 --one-top-level=./lib2
  
  # diff transferred lib and ./lib2 with 3rd tools
  > ...
  ```



### History

* 2023.11.12 first release.

### Changes



### License

Orginal mocha based.
