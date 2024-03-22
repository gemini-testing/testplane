# Release schedule

Current — latest major version. Usually lives for about 6 months, and then becomes Active.

Active — Long-term Support major version which is recommended to have on all projects in the testing pipeline. Active usually lives for about a year, but exceptions are possible. Active will be renewed if necessary to properly test the next Current in order to switch Active to it.

Maintanance — a period of at least one year when the major version will receive support (bug fixed, security issues fixes, etc). After the Maintanance period expires, the version will be declared Deprecated and will no longer be supported. Maintanance begins when the next major moves into Active.


```mermaid
gantt
    title Release Schedule
    dateFormat  YYYY-MM-DD

    section 3.x
        Current          :a31, 2020-01-28, 6M
        Active              :active, a32, after a31, 1y
        Maintanance      :a33, after a32, 1y
        Deprecated       :milestone, a34, after a33, 1s

    section 4.x
        Current          :a41, 2021-01-28, 6M
        Active              :active, a42, after a41, 2022-12-11
        Maintanance      :a43, after a42, 1y
        Deprecated       :milestone, a44, after a43, 1s


    section 5.x
        Current          :a51, 2022-06-11, 6M
        Active              :active, a52, after a51, 2023-06-22
        Maintanance      :a53, after a52, 1y
        Deprecated       :milestone, a54, after a53, 1s

    section 6.x
        Current          :a61, 2022-12-22, 6M
        Active              :active, a62, after a61, 2023-09-30
        Maintanance      :a63, after a62, 1y
        Deprecated       :milestone, a64, after a63, 1s

    section 7.x
        Current          :a71, 2023-03-31, 6M
        Active              :active, a72, after a71, 1y
        Maintanance      :a73, after a72, 1y
        Deprecated       :milestone, a74, after a73, 1s
    
    section 8.x
        Current          :crit, a81, 2024-01-17, 2024-09-30
        Active              :active, a82, after a81, 1y
        Maintanance      :a83, after a82, 1y
        Deprecated       :milestone, a84, after a83, 1s
```
